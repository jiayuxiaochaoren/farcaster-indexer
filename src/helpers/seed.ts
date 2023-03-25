import { fromFarcasterTime, HubResult } from '@farcaster/hub-nodejs'
import * as protobufs from '@farcaster/protobufs'

import { client, formatHash } from '../lib.js'
import supabase from '../supabase.js'
import { Cast, Profile, Reaction, Signer, Verification } from '../types/db.js'
import { MergeMessageHubEvent } from '../types/index.js'
import { account } from './dummy.js'

/**
 * Seed the database with data from the hub
 */
export async function seed() {
  const allFids = await getAllFids()
  const allCasts: Cast[] = []
  const allReactions: Reaction[] = []
  const allUserData: Profile[] = []
  const allVerifications: Verification[] = []
  const allSigners: Signer[] = []

  for (const fid of allFids) {
    // TODO: remove following line after testing
    if (fid !== account.fid) continue

    const profile = await getFullProfileFromHub(fid)

    allCasts.push(...profile.casts)
    allReactions.push(...profile.reactions)
    allUserData.push(...profile.userData)
    // allVerifications.push(...profile.verifications)
    // allSigners.push(...profile.signers)
  }

  // TODO: upsert everything after indexing a few hundred names to not have a massive queue at the end
  const { error: castError } = await supabase.from('casts').upsert(allCasts, {
    onConflict: 'hash',
  })

  if (castError) {
    console.error('ERROR UPSERTING CASTS', castError)
  }

  const { error: reactionError } = await supabase
    .from('reaction')
    .upsert(allReactions, {
      onConflict: 'fid,target_cast',
    })

  if (reactionError) {
    console.error('ERROR UPSERTING REACTIONS', reactionError)
  }

  const { error: userDataError } = await supabase
    .from('profile')
    .upsert(allUserData, {
      onConflict: 'id',
    })

  if (userDataError) {
    console.error('ERROR UPSERTING USER DATA', userDataError)
  }

  console.log('Done seeding')
}

/**
 * Index all messages from a profile
 * @param fid Farcaster ID
 */
async function getFullProfileFromHub(_fid: number) {
  const fid = protobufs.FidRequest.create({ fid: _fid })
  protobufs.Metadata

  // TODO: add pagination for all of these (mainly casts and reactions)
  const _casts = (await client.getCastsByFid(fid))._unsafeUnwrap()
  const _reactions = (await client.getReactionsByFid(fid))._unsafeUnwrap()
  const _userData = (await client.getUserDataByFid(fid))._unsafeUnwrap()
  const _verifications = (
    await client.getVerificationsByFid(fid)
  )._unsafeUnwrap()
  const signersResponse = (await client.getSignersByFid(fid))._unsafeUnwrap()

  const casts = hubMessageToJSON(_casts.messages) as MergeMessageHubEvent[]
  // prettier-ignore
  const reactions = hubMessageToJSON(_reactions.messages) as MergeMessageHubEvent[]
  // prettier-ignore
  const userData = hubMessageToJSON(_userData.messages) as MergeMessageHubEvent[]
  // prettier-ignore
  const verifications = hubMessageToJSON(_verifications.messages) as MergeMessageHubEvent[]
  // prettier-ignore
  const signers = hubMessageToJSON(signersResponse.messages) as MergeMessageHubEvent[]

  const formattedCasts: Cast[] = casts.map((cast) => {
    const timestamp = fromFarcasterTime(cast.data.timestamp)._unsafeUnwrap()
    return {
      hash: cast.hash,
      signature: cast.signature,
      signer: cast.signer,
      text: cast.data.castAddBody!.text,
      fid: _fid,
      mentions: cast.data.castAddBody!.mentions,
      parent_fid: cast.data.castAddBody!.parentCastId?.fid,
      parent_hash: cast.data.castAddBody!.parentCastId?.hash,
      thread_hash: null,
      deleted: false,
      published_at: new Date(timestamp),
    }
  })

  const formattedReactions: Reaction[] = reactions.map((reaction) => {
    const timestamp = fromFarcasterTime(reaction.data.timestamp)._unsafeUnwrap()
    return {
      fid: reaction.data.fid,
      target_cast: formatHash(reaction.data.reactionBody!.targetCastId.hash),
      target_fid: reaction.data.reactionBody!.targetCastId.fid,
      type: reaction.data.reactionBody!.type.toString(),
      created_at: new Date(timestamp),
    }
  })

  // TODO: figure out how `userDataBody` works with enums
  const formattedUserData: Profile[] = userData.map((user) => {
    const timestamp = fromFarcasterTime(user.data.timestamp)._unsafeUnwrap()
    return {
      id: user.data.fid,
      // username: '',
      // display_name: '',
      // bio: '',
      // url: '',
      // avatar_url: '',
      registered_at: new Date(timestamp),
      updated_at: new Date(),
    }
  })

  return {
    casts: formattedCasts,
    reactions: formattedReactions,
    userData: formattedUserData,
    verifications,
    signers,
  }
}

/**
 * Convert Hub messages from protobufs to JSON
 * @param messages List of Hub messages as protobufs
 * @returns List of Hub messages as JSON
 */
function hubMessageToJSON(messages: protobufs.Message[]) {
  return messages.map((message) => {
    const json = protobufs.Message.toJSON(message) as MergeMessageHubEvent

    return {
      data: json.data,
      hash: formatHash(json.hash),
      hashScheme: json.hashScheme,
      signature: formatHash(json.signature),
      signatureScheme: json.signatureScheme,
      signer: formatHash(json.signer),
    }
  })
}

/**
 * Get all fids from a hub
 * @returns array of fids
 */
async function getAllFids() {
  const fids = new Array<number>()
  let nextPageToken: Uint8Array | undefined = undefined
  let isNextPage = true

  while (isNextPage) {
    const fidsResult: HubResult<protobufs.FidsResponse> = await client.getFids(
      protobufs.FidsRequest.create({ pageToken: nextPageToken })
    )

    if (fidsResult.isErr()) {
      console.error(fidsResult.error)
      break
    }

    const response: protobufs.FidsResponse = fidsResult.value
    fids.push(...response.fids)
    nextPageToken = response.nextPageToken
    isNextPage = !!nextPageToken && nextPageToken.length > 0
  }

  return fids
}
