import { EventRequest } from '@farcaster/hub-nodejs'
import 'dotenv/config'

import { getLatestEvent } from './api/event.js'
import { backfill } from './backfill.js'
import { hubClient, validateHubClient } from './lib/hub-client.js'
import { log } from './lib/logger.js'
import { subscribe } from './lib/subscriber.js'

await validateHubClient()

// Check the latest hub event we processed, if any
let latestEventId = await getLatestEvent()

// Hubs are expected to prune messages after 3 days
const latestEventRequest = EventRequest.create({ id: latestEventId })
const latestEvent = await hubClient.getEvent(latestEventRequest)

// If the last saved event is no longer available, we need to backfill from the beginning
if (!latestEvent.isOk()) {
  log.warn('Latest recorded event is no longer available')
  latestEventId = undefined
}

// If the first argument is "--backfill" or `latestEventId` is undefined, run backfill()
if (process.argv[2] === '--backfill' || !latestEventId) {
  await backfill({ maxFid: 10 })

  log.info('Waiting for batchers to finish processing...')
  await new Promise((resolve) => setTimeout(resolve, 10_000))

  // An event id is recorded before backfilling begins so we can pick up where we left off
  latestEventId = await getLatestEvent()
}

await subscribe(latestEventId)
