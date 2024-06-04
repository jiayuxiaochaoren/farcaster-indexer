import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js'
import { ExpressAdapter } from '@bull-board/express'
import { extractEventTimestamp } from '@farcaster/hub-nodejs'
import express from 'express'

import { getLatestEvent } from '../api/event.js'
import { backfillQueue } from './backfill.js'
import { log } from './logger.js'
import { removeCompleteJob, streamQueue } from './subscriber.js'

export function initExpressApp() {
  const app = express()
  const serverAdapter = new ExpressAdapter()

  app.listen(3001, () => {
    log.info('Server started on http://localhost:3001')
  })

  serverAdapter.setBasePath('/')
  app.use('/', serverAdapter.getRouter())

  app.get('/stats', async (req, res) => {
    let latestEventTimestamp
    const latestEventId = await getLatestEvent()
    const isBackfillActive = (await backfillQueue.getActiveCount()) > 0

    if (latestEventId) {
      latestEventTimestamp = extractEventTimestamp(latestEventId)
    }

    return res
      .status(200)
      .json({ latestEventId, latestEventTimestamp, isBackfillActive })
  })

  app.get('/removeJobs', async (req, res) => {
    await removeCompleteJob()
    const cou = await streamQueue.getJobCounts()
    return res
      .status(200)
      .json({ 'message': 'ok','data':cou })
  })

  createBullBoard({
    queues: [new BullMQAdapter(backfillQueue), new BullMQAdapter(streamQueue)],
    serverAdapter,
  })
}
