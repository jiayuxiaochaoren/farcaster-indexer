import { db } from '../db/kysely.js'
import { log } from '../lib/logger.js'

const tableName = 'latest_fid_pulls'
export async function upsertLatestFidPull(fid: number, updatedAt: Date) {
  try {
    await db.insertInto(tableName).values({ fid, updatedAt }).execute()

    log.debug(`LATEST FID PULL UPSERTED FOR FID ${fid}`)
  } catch (error) {
    log.error(error, 'ERROR INSERTING LATEST FID PULL')
  }
}

export async function selectAllLatestFidPulls() {
  try {
    const rows = await db
      .selectFrom(tableName)
      .select(['fid', 'updatedAt'])
      .orderBy('updatedAt', 'desc') // Then order by updatedAt in descending order
      .execute()

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
