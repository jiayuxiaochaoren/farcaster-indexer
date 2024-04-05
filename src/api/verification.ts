import { Message, fromFarcasterTime } from '@farcaster/hub-nodejs'

import { db } from '../db/kysely.js'
import { log } from '../lib/logger.js'
import { formatVerifications } from '../lib/utils.js'

/**
 * Insert a new verification in the database
 * @param msg Hub event in JSON format
 */
export async function insertVerifications(msgs: Message[]): Promise<void> {
  const verifications = formatVerifications(msgs)

  try {
    const insertedResult = await db
      .insertInto('verifications')
      .values(verifications)
      .onConflict((oc) => oc.columns(['fid', 'signerAddress']).doNothing())
      .execute()

    log.debug(
      `VERIFICATIONS INSERTED (${insertedResult[0].numInsertedOrUpdatedRows?.toLocaleString()})`
    )
  } catch (error) {
    log.error(error, 'ERROR INSERTING VERIFICATION')
  }
}

/**
 * Delete a verification from the database
 * @param msg Hub event in JSON format
 */
export async function deleteVerifications(msgs: Message[]): Promise<void> {
  try {
    await db.transaction().execute(async (transaction) => {
      for (const msg of msgs) {
        const data = msg.data!
        const address = data.verificationRemoveBody!.address

        await transaction
          .updateTable('verifications')
          .set({
            deletedAt: new Date(
              fromFarcasterTime(data.timestamp)._unsafeUnwrap()
            ),
          })
          .where('signerAddress', '=', address)
          .where('fid', '=', data.fid)
          .execute()
      }
    })

    log.debug('VERIFICATIONS DELETED')
  } catch (error) {
    log.error(error, 'ERROR DELETING VERIFICATION')
  }
}
