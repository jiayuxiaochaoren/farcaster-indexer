import { Message } from '@farcaster/hub-nodejs'

import { db } from '../db/kysely.js'
import { log } from '../lib/logger.js'
import { formatUserDatas } from '../lib/utils.js'

export async function insertUserDatas(msgs: Message[]) {
  const userDatas = formatUserDatas(msgs)

  try {
    const insertedResult = await db
      .insertInto('userData')
      .values(userDatas)
      .onConflict((oc) =>
        oc.columns(['fid', 'type']).doUpdateSet((eb) => ({
          value: eb.ref('excluded.value'),
        }))
      )
      .execute()

    log.debug(
      `USER DATAS INSERTED (${insertedResult[0].numInsertedOrUpdatedRows?.toLocaleString()})`
    )
  } catch (error) {
    log.error(error, 'ERROR INSERTING USER DATA')
  }
}
