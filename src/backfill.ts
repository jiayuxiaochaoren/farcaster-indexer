import { FidRequest } from '@farcaster/hub-nodejs'
import { Presets, SingleBar } from 'cli-progress'
import 'dotenv/config'

import {
  selectLatestFidPull,
  upsertLatestFidPull,
} from './api/latest-fid-pulls.js'
import {
  castAddBatcher,
  linkAddBatcher,
  reactionAddBatcher,
  userDataAddBatcher,
  verificationAddBatcher,
} from './lib/batch.js'
import { client } from './lib/client.js'
import { saveCurrentEventId } from './lib/event.js'
import { log } from './lib/logger.js'
import { getAllCastsByFid, getAllReactionsByFid } from './lib/paginate.js'
import { checkMessages } from './lib/utils.js'

const progressBar = new SingleBar({ fps: 1 }, Presets.shades_classic)

interface FidRange {
  minFid?: number
  maxFid?: number
}
const threeDaysAgo = new Date(new Date().getTime() - 3 * 24 * 60 * 60 * 1000)
/**
 * Backfill the database with data from a hub. This may take a while.
 */
export async function backfill({
  minFid = 1,
  maxFid = Number.MAX_SAFE_INTEGER,
}: FidRange = {}): Promise<void> {
  // Save the current event ID so we can start from there after backfilling
  await saveCurrentEventId()

  log.info('Backfilling...')
  const startTime = new Date().getTime()
  const allFids = await getAllFids({ minFid, maxFid })
  progressBar.start(allFids.length, 0)

  log.debug(`Fids to backfill: ${allFids.length}`)
  for (const fid of allFids) {
    progressBar.increment()
    const latestFidPull = await selectLatestFidPull(fid)
    const fidPulledRecently: boolean =
      typeof latestFidPull !== 'undefined' && latestFidPull >= threeDaysAgo

    if (fidPulledRecently) {
      log.debug(
        `fid ${fid} was pulled recently. Skipping fetching latest profile from hub.`
      )
      continue
    }

    const timestamp = new Date()
    await getFullProfileFromHub(fid)
      .then((profile) => {
        return Promise.allSettled([
          ...profile.casts.map((msg) => castAddBatcher.add(msg)),
          ...profile.links.map((msg) => linkAddBatcher.add(msg)),
          ...profile.reactions.map((msg) => reactionAddBatcher.add(msg)),
          ...profile.userData.map((msg) => userDataAddBatcher.add(msg)),
          ...profile.verifications.map((msg) =>
            verificationAddBatcher.add(msg)
          ),
        ])
      })
      .then(() => {
        void upsertLatestFidPull(fid, timestamp)
      })
      .catch((err) => {
        log.error(err, `Error getting profile for FID ${fid}`)
      })
  }

  const endTime = new Date().getTime()
  const elapsedMilliseconds = endTime - startTime
  const elapsedMinutes = elapsedMilliseconds / 60000
  log.info(`Done backfilling in ${elapsedMinutes} minutes`)
  progressBar.stop()
}

/**
 * Index all messages from a profile
 * @param fid Farcaster ID
 */
async function getFullProfileFromHub(fid: number) {
  const fidRequest = FidRequest.create({ fid })

  const [casts, reactions, links, userData, verifications] = await Promise.all([
    getAllCastsByFid(fidRequest),
    getAllReactionsByFid(fidRequest),
    client.getLinksByFid({ ...fidRequest, reverse: true }),
    client.getUserDataByFid(fidRequest),
    client.getVerificationsByFid(fidRequest),
  ])

  return {
    casts,
    reactions,
    links: checkMessages(links, fid),
    userData: checkMessages(userData, fid),
    verifications: checkMessages(verifications, fid),
  }
}

/**
 * Get all fids
 * @returns array of fids
 */
export async function getAllFids({
  minFid = 1,
  maxFid = Number.MAX_SAFE_INTEGER,
}: FidRange = {}): Promise<ReadonlyArray<number>> {
  const maxFidResult = await client.getFids({
    pageSize: 1,
    reverse: true,
  })

  if (maxFidResult.isErr()) {
    throw new Error('Unable to getFids', { cause: maxFidResult.error })
  }
  const newestFid = maxFidResult.value.fids[0]

  const endOfArray: number = newestFid > maxFid ? maxFid : newestFid
  return Array.from({ length: endOfArray - minFid + 1 }, (_, i) => minFid + i)
}
