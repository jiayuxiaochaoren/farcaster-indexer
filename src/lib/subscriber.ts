import {
  HubEvent,
  HubEventType,
  fromFarcasterTime,
} from '@farcaster/hub-nodejs'

import { insertEvent } from '../api/event.js'
import {
  selectLatestFidPull,
  upsertLatestFidPull,
} from '../api/latest-fid-pulls.js'
import { handleEvent } from './event.js'
import { hubClient } from './hub-client.js'
import { log } from './logger.js'
import { threeDaysAgo } from './utils.js'

let latestEventId: number | undefined

/**
 * Listen for new events from a Hub
 */
export async function subscribe(fromEventId: number | undefined) {
  const result = await hubClient.subscribe({
    eventTypes: [
      HubEventType.MERGE_MESSAGE,
      HubEventType.PRUNE_MESSAGE,
      HubEventType.REVOKE_MESSAGE,
      // HubEventType.MERGE_USERNAME_PROOF,
      // HubEventType.MERGE_ON_CHAIN_EVENT,
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
        `Subscribed to stream ${fromEventId ? `from event ${fromEventId}` : ''}`
      )

      stream.on('data', (hubEvent: HubEvent) => {
        void (async () => {
          // Keep track of latest event so we can pick up where we left off if the stream is interrupted
          latestEventId = hubEvent.id

          await handleEvent(hubEvent).then(async () => {
            // If user had event within last three days, reset their latest fid pull to current
            const msg = hubEvent.mergeMessageBody?.message
            const fid = msg?.data?.fid
            if (typeof fid === 'number') {
              const latestFidPull = await selectLatestFidPull(fid)
              const fidPulledRecently: boolean =
                typeof latestFidPull !== 'undefined' &&
                latestFidPull >= threeDaysAgo

              if (fidPulledRecently) {
                const timestamp = msg?.data?.timestamp
                if (timestamp) {
                  const updatedAt = new Date(
                    fromFarcasterTime(timestamp)._unsafeUnwrap()
                  )
                  return upsertLatestFidPull(fid, updatedAt)
                }
              }
            }
          })
        })()
      })

      stream.on('close', () => {
        log.warn(`Hub stream closed`)
      })

      stream.on('end', () => {
        log.warn(`Hub stream ended`)
      })
    },
    (e) => {
      log.error(e, 'Error streaming data.')
    }
  )
}

// Handle graceful shutdown and log the latest event ID
async function handleShutdownSignal(signalName: NodeJS.Signals) {
  hubClient.close()
  log.info(`${signalName} received`)

  // TODO: figure out how to handle this in a more robust way.
  // As-is, the latest event ID will be logged but we don't know if
  // it was successfully processed due to the Bottleneck.Batcher logic
  if (latestEventId) {
    log.info(`Latest event ID: ${latestEventId}`)
    await insertEvent(latestEventId)
  } else {
    log.warn('No hub event in cache')
  }

  process.exit(0)
}

process.on('SIGINT', () => {
  void handleShutdownSignal('SIGINT')
})

process.on('SIGTERM', () => {
  void handleShutdownSignal('SIGTERM')
})

process.on('SIGQUIT', () => {
  void handleShutdownSignal('SIGQUIT')
})
