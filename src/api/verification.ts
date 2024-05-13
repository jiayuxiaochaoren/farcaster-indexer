import { Message } from '@farcaster/hub-nodejs'

import { db } from '../db/kysely.js'
import { log } from '../lib/logger.js'
import { farcasterTimeToDate, formatVerifications } from '../lib/utils.js'

/**
 * Insert a new verification in the database
 * @param msg Hub event in JSON format
 */
export async function insertVerifications(msgs: Message[]) {
  const verifications = formatVerifications(msgs)
  if (verifications.length === 0) return

  try {
    await db
      .insertInto('verifications')
      .values(verifications)
      .onConflict((oc) => oc.columns(['fid', 'signerAddress']).doNothing())
      .execute()

    log.debug(`VERIFICATIONS INSERTED`)
  } catch (error) {
    log.error(error, 'ERROR INSERTING VERIFICATIONS')
    throw error
  }
}

/**
 * Delete a verification from the database
 * @param msg Hub event in JSON format
 */
export async function deleteVerifications(msgs: Message[]) {
  try {
    await db.transaction().execute(async (trx) => {
      for (const msg of msgs) {
        const data = msg.data!
        const address = data.verificationRemoveBody!.address

        await trx
          .updateTable('verifications')
          .set({ deletedAt: farcasterTimeToDate(data.timestamp) })
          .where('signerAddress', '=', address)
          .where('fid', '=', data.fid)
          .execute()
      }
    })

    log.debug('VERIFICATIONS DELETED')
  } catch (error) {
    log.error(error, 'ERROR DELETING VERIFICATIONS')
    throw error
  }
}
