import { db } from '../db/kysely.js'

import { log } from '../lib/logger.js'

const tableName = 'latest_fid_pulls'
export async function upsertLatestFidPull(
  fid: number,
  timestamp: Date
): Promise<void> {
  try {
    // TODO: Optimize upsert so we don't waste a delete operation here
    await db
      .deleteFrom(tableName)
      .where('fid', '=', fid)
      .execute()
      .then(() =>
        db.insertInto(tableName).values({ fid, updatedAt: timestamp }).execute()
      )
  } catch (error) {
    log.error(error, 'ERROR INSERTING LATEST FID PULL')
  }
}

export async function selectLatestFidPull(fid: number) {
  try {
    const row = await db
      .selectFrom(tableName)
      .selectAll()
      .where('fid', '=', fid)
      .executeTakeFirst()
    return row?.updatedAt
  } catch (error) {
    log.error(error, 'ERROR SELECTING LATEST FID PULL')
  }
}
