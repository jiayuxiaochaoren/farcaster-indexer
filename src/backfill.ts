import { Presets, SingleBar } from 'cli-progress'
import pLimit from 'p-limit'

import {
  selectAllLatestFidPulls,
  upsertLatestFidPull,
} from './api/latest-fid-pulls.js'
import { FidHubFetcher } from './lib/FidHubFetcher.js'
import {
  castAddBatcher,
  linkAddBatcher,
  reactionAddBatcher,
  userDataAddBatcher,
  verificationAddBatcher,
} from './lib/batch.js'
import { saveCurrentEventId } from './lib/event.js'
import { hubClient } from './lib/hub-client.js'
import { log } from './lib/logger.js'
import { threeDaysAgo } from './lib/utils.js'

const MAX_CONCURRENCY = 5
const limit = pLimit(MAX_CONCURRENCY)

const progressBar = new SingleBar({ fps: 1 }, Presets.shades_classic)

interface FidRange {
  minFid?: number
  maxFid?: number
}

/**
 * Backfill the database with data from a hub. This may take a while.
 */
export async function backfill({
  minFid = 1,
  maxFid = Number.MAX_SAFE_INTEGER,
}: FidRange = {}) {
  // Save the current event ID so we can start from there after backfilling
  await saveCurrentEventId()

  log.info('Backfilling...')
  const startTime = new Date().getTime()
  const allFids = await getAllFids({ minFid, maxFid })
  const latestFidPullRows = await selectAllLatestFidPulls()

  const fidsToPull = allFids.filter((fid) => {
    const latestFidPull = latestFidPullRows.find(
      (latestFidPullRow) => latestFidPullRow.fid === fid
    )?.updatedAt

    const fidPulledRecently = !!latestFidPull && latestFidPull >= threeDaysAgo
    return !fidPulledRecently
  })

  progressBar.start(fidsToPull.length, minFid)
  log.debug(`Fids to backfill: ${fidsToPull.length.toLocaleString()}`)

  const allPromises = fidsToPull.map((fid) => {
    return limit(async () => {
      log.debug(`Starting fetch of fid ${fid}`)
      const updatedAt = new Date()

      try {
        try {
          await getFullProfileFromHub(fid)
          void upsertLatestFidPull(fid, updatedAt)
        } catch (err) {
          log.error(err, `Error getting profile for FID ${fid}`)
        }
      } finally {
        progressBar.increment()
      }
    })
  })

  await Promise.all(allPromises)

  const endTime = new Date().getTime()
  const elapsedMilliseconds = endTime - startTime
  const elapsedMinutes = elapsedMilliseconds / 60000
  log.info(
    `Done backfilling ${fidsToPull.length.toLocaleString()} fids in ${elapsedMinutes} minutes`
  )
  progressBar.stop()
}

/**
 * Index all messages from a profile
 * @param fid Farcaster ID
 */
async function getFullProfileFromHub(fid: number) {
  const fidHubFetcher = new FidHubFetcher(fid)

  // TODO: Test if `Promise.all` actually makes this faster
  return Promise.all([
    fidHubFetcher
      .getAllCastsByFid()
      .then((casts) => casts.map((cast) => castAddBatcher.add(cast))),

    fidHubFetcher
      .getAllReactionsByFid()
      .then((reactions) =>
        reactions.map((reaction) => reactionAddBatcher.add(reaction))
      ),

    fidHubFetcher
      .getAllLinksByFid()
      .then((links) => links.map((link) => linkAddBatcher.add(link))),

    fidHubFetcher
      .getAllUserDataByFid()
      .then((userDatas) =>
        userDatas.map((userData) => userDataAddBatcher.add(userData))
      ),

    fidHubFetcher
      .getAllVerificationsByFid()
      .then((verifications) =>
        verifications.map((verification) =>
          verificationAddBatcher.add(verification)
        )
      ),
  ])
}

/**
 * Get all fids
 * @returns array of fids
 */
export async function getAllFids({
  minFid = 1,
  maxFid = Number.MAX_SAFE_INTEGER,
}: FidRange = {}) {
  const maxFidResult = await hubClient.getFids({
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
