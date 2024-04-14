import { Message, fromFarcasterTime } from '@farcaster/hub-nodejs'

import { db } from '../db/kysely.js'
import { log } from '../lib/logger.js'
import { formatCasts } from '../lib/utils.js'

/**
 * Insert casts in the database
 * @param msg Hub event in JSON format
 */
export async function insertCasts(msgs: Message[]) {
  const casts = formatCasts(msgs)

  try {
    const insertResult = await db
      .insertInto('casts')
      .values(casts)
      .onConflict((oc) => oc.column('hash').doNothing())
      .execute()

    log.debug(
      `CASTS INSERTED (${insertResult[0].numInsertedOrUpdatedRows?.toLocaleString()})`
    )
  } catch (error) {
    log.error(error, 'ERROR INSERTING CAST')
  }
}

/**
 * Update a cast in the database
 * @param hash Hash of the cast
 * @param change Object with the fields to update
 */
export async function deleteCasts(msgs: Message[]) {
  try {
    await db.transaction().execute(async (trx) => {
      for (const msg of msgs) {
        const data = msg.data!

        const targetHash = data.castRemoveBody?.targetHash
        const deletedAt = new Date(
          fromFarcasterTime(data.timestamp)._unsafeUnwrap()
        )

        if (!targetHash) {
          log.warn('No target hash to delete cast')
          continue
        }

        await trx
          .updateTable('casts')
          .set({
            deletedAt,
          })
          .where('hash', '=', targetHash)
          .execute()
      }
    })

    log.debug(`CASTS DELETED`)
  } catch (error) {
    log.error(error, 'ERROR DELETING CAST')
  }
}
