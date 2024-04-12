import { Kysely, sql } from 'kysely'

export const up = async (db: Kysely<unknown>) => {
  await db.schema
    .createTable('latest_fid_pulls')
    .addColumn('id', 'uuid', (col) =>
      col.defaultTo(sql`generate_ulid()`).primaryKey()
    )
    .addColumn('fid', 'int8', (col) => col.notNull())
    .addColumn('updatedAt', 'timestamptz', (col) => col.notNull())
    .execute()
}

export const down = async (db: Kysely<unknown>) => {
  await db.schema.dropTable('latest_fid_pulls').ifExists().execute()
}
