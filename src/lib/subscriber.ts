import { HubEvent, HubEventType } from '@farcaster/hub-nodejs'

import { getLatestEvent, saveLatestEventId } from '../api/event.js'
import { createQueue, createWorker } from './bullmq.js'
import { handleEvent } from './event.js'
import { hubClient } from './hub-client.js'
import { log } from './logger.js'

export const streamQueue = createQueue<Buffer>('stream')
createWorker<Buffer>('stream', handleEvent, { concurrency: 600 })
/**
 * Listen for new events from a Hub
 */
export async function subscribe(fromEventId: number | undefined) {
  const result = await hubClient.subscribe({
    eventTypes: [
      HubEventType.MERGE_MESSAGE,
      HubEventType.PRUNE_MESSAGE,
      HubEventType.REVOKE_MESSAGE,
      HubEventType.MERGE_ON_CHAIN_EVENT,
    ],
    fromId: fromEventId,
  })

  if (result.isErr()) {
    log.error(result.error, 'Error starting stream')
    return
  }

  result.match(
    (stream) => {
      log.info(
        `Subscribed to stream from ${fromEventId ? `event ${fromEventId}` : 'head'}`
      )
      setTimeout(async() => {
        console.log('get job detail',await streamQueue.getJobCounts())
      },1000)
      stream.on('data', async (e: HubEvent) => {
        const encodedEvent = Buffer.from(HubEvent.encode(e).finish())
        await streamQueue.add('stream', encodedEvent, {
          removeOnComplete: true,
          removeOnFail: 100,
          // jobId: e.id.toString()
        })
        // TODO: we can probably remove the `hub:latest-event-id` key and just use the last event ID in the queue
        await saveLatestEventId(e.id)

      // console.log('ddddd',await streamQueue.getJobCounts())

      })

      stream.on('close', async () => {
        log.warn(`Hub stream closed`)
      })

      stream.on('end', async () => {
        log.warn(`Hub stream ended`)
        setTimeout(async () => {
          const latestEvent = await getLatestEvent()
          await subscribe(latestEvent)
      },1000)
      })

      // console.log('ddddd',streamQueue.getActiveCount(),streamQueue.getCompletedCount(),streamQueue.getJobCounts())
    },
    (e) => {
      log.error(e, 'Error streaming data.')
    }
  )
}

export async function removeCompleteJob() {
  const removeJobs = await streamQueue.clean(300, 10000, "completed")
  // const removeJobs2 = await streamQueue.clean(300, 10000, "paused")
  // const removeJobs3 = await streamQueue.clean(300, 10000, "delayed")
  // const removeJobs4 = await streamQueue.clean(300, 10000, "failed")
  // const removeJobs5 = await streamQueue.clean(300, 10000, "wait")
  // const removeJobs6 = await streamQueue.clean(300, 10000, "prioritized")
  // const removeJobs7 = await streamQueue.clean(300, 10000, "active")
  // const removeAll = await streamQueue.obliterate()
  

  log.info('removeJobs:',await streamQueue.getJobCounts(),removeJobs)
}
