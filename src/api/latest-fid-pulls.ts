import { LatestFidPullsRow } from '../db/db.types.js'
import { db } from '../db/kysely.js'

import { log } from '../lib/logger.js'

const tableName = 'latest_fid_pulls'
export async function upsertLatestFidPull(
  fid: number,
  updatedAt: Date
): Promise<void> {
  try {
    // TODO: Optimize upsert so we don't waste a delete operation here
    await db.transaction().execute(async (transaction) => {
      await transaction.deleteFrom(tableName).where('fid', '=', fid).execute()
      await transaction
        .insertInto(tableName)
        .values({ fid, updatedAt })
        .execute()
    })

    log.debug(`LATEST FID PULL UPSERTED FOR FID ${fid}`)
  } catch (error) {
    log.error(error, 'ERROR INSERTING LATEST FID PULL')
  }
}

export async function selectAllLatestFidPulls(): Promise<
  ReadonlyArray<LatestFidPullsRow>
> {
  try {
    const rows = await db.selectFrom(tableName).selectAll().execute()
    // db returns string for fid but our TS types state this should be a Number
    return rows.map((row) => ({ ...row, fid: Number(row.fid) }))
  } catch (error) {
    log.error(error, 'ERROR SELECTING ALL LATEST FID PULLS')
    throw error
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
