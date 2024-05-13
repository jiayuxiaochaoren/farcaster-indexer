import { Kysely, sql } from 'kysely'

/**************************************************************************************************
  Notes about the patterns in this file:

  * Uses ULIDs as the surrogate key for most tables so that we don't rely on sequences, allowing
    tables to be partitioned in the future if needed. ULIDs still have temporal ordering unlike 
    most UUIDs.

  * Uses created_at/updated_at columns to refer to database row create/update time, NOT 
    the creation time of the entity on the Farcaster network itself. 
    Separate columns (e.g. "timestamp") represent when the content was created on Farcaster.

  * Declares columns in a particular order to minimize storage on disk. If the declaration order 
    looks odd, remember it's to reduce disk space. 
    See https://www.2ndquadrant.com/en/blog/on-rocks-and-sand/ for more info.

  * Uses bytea columns to store raw bytes instead of text columns with `0x` prefixed strings, since
    raw bytes reduce storage space, reduce index size, are faster to query (especially with joins), 
    and avoid case sensitivity issues when dealing with string comparison.

  * Uses B-tree indexes (the default) for most columns representing a hash digest, since you can 
    perform lookups on those hashes matching by prefix, whereas you can't do this with hash indexes.
  
  * Declares some indexes that we think might be useful for data analysis and general querying, 
    but which aren't actually required by the replicator itself.

  * Declares partial indexes (via a WHERE predicate) to reduce the size of the index and ensure
    only relevant rows are returned (e.g. ignoring soft-deleted rows, etc.)

  * Uses JSON columns instead of native Postgres array columns to significantly reduce on-disk 
    storage (JSON is treated like TEXT) at the cost of slightly slower querying time. JSON columns
    can also be more easily modified over time without requiring a schema migration.
**************************************************************************************************/

export const up = async (db: Kysely<any>) => {
  // Used for generating random bytes in ULID creation
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db)

  // ULID generation function for creating unique IDs without centralized coordination.
  // Avoids limitations of a monotonic (auto-incrementing) ID.
  await sql`CREATE OR REPLACE FUNCTION generate_ulid() RETURNS uuid
    LANGUAGE sql STRICT PARALLEL SAFE
    RETURN ((lpad(to_hex((floor((EXTRACT(epoch FROM clock_timestamp()) * (1000)::numeric)))::bigint), 12, '0'::text) || encode(gen_random_bytes(10), 'hex'::text)))::uuid;
  `.execute(db)

  // CASTS
  await db.schema
    .createTable('casts')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.defaultTo(sql`generate_ulid()`).primaryKey()
    )
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('timestamp', 'timestamptz', (col) => col.notNull())
    .addColumn('deletedAt', 'timestamptz')
    .addColumn('prunedAt', 'timestamptz')
    .addColumn('fid', 'bigint', (col) => col.notNull())
    .addColumn('parentFid', 'bigint')
    .addColumn('hash', 'bytea', (col) => col.notNull().unique())
    .addColumn('rootParentHash', 'bytea')
    .addColumn('parentHash', 'bytea')
    .addColumn('rootParentUrl', 'text')
    .addColumn('parentUrl', 'text')
    .addColumn('text', 'text', (col) => col.notNull())
    .addColumn('embeds', 'json', (col) => col.notNull().defaultTo(sql`'[]'`))
    .addColumn('mentions', 'json', (col) => col.notNull().defaultTo(sql`'[]'`))
    .addColumn('mentionsPositions', 'json', (col) =>
      col.notNull().defaultTo(sql`'[]'`)
    )
    .execute()

  await db.schema
    .createIndex('casts_active_fid_timestamp_index')
    .ifNotExists()
    .on('casts')
    .columns(['fid', 'timestamp'])
    .where(sql.ref('deleted_at'), 'is', null) // Only index active (non-deleted) casts
    .execute()

  await db.schema
    .createIndex('casts_timestamp_index')
    .ifNotExists()
    .on('casts')
    .columns(['timestamp'])
    .execute()

  await db.schema
    .createIndex('casts_parent_hash_index')
    .ifNotExists()
    .on('casts')
    .column('parentHash')
    .where('parentHash', 'is not', null)
    .execute()

  await db.schema
    .createIndex('casts_root_parent_hash_index')
    .ifNotExists()
    .on('casts')
    .columns(['rootParentHash'])
    .where('rootParentHash', 'is not', null)
    .execute()

  await db.schema
    .createIndex('casts_parent_url_index')
    .ifNotExists()
    .on('casts')
    .columns(['parentUrl'])
    .where('parentUrl', 'is not', null)
    .execute()

  await db.schema
    .createIndex('casts_root_parent_url_index')
    .ifNotExists()
    .on('casts')
    .columns(['rootParentUrl'])
    .where('rootParentUrl', 'is not', null)
    .execute()

  // REACTIONS
  await db.schema
    .createTable('reactions')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.defaultTo(sql`generate_ulid()`).primaryKey()
    )
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('timestamp', 'timestamptz', (col) => col.notNull())
    .addColumn('deletedAt', 'timestamptz')
    .addColumn('prunedAt', 'timestamptz')
    .addColumn('fid', 'bigint', (col) => col.notNull())
    .addColumn('targetCastFid', 'bigint')
    .addColumn('type', 'int2', (col) => col.notNull())
    .addColumn('hash', 'bytea', (col) => col.notNull().unique())
    .addColumn('targetCastHash', 'bytea')
    .addColumn('targetUrl', 'text')
    .execute()

  await db.schema
    .createIndex('reactions_active_fid_timestamp_index')
    .ifNotExists()
    .on('reactions')
    .columns(['fid', 'timestamp'])
    .where(sql.ref('deleted_at'), 'is', null) // Only index active (non-deleted) reactions
    .execute()

  await db.schema
    .createIndex('reactions_target_cast_hash_index')
    .ifNotExists()
    .on('reactions')
    .column('targetCastHash')
    .where('targetCastHash', 'is not', null)
    .execute()

  await db.schema
    .createIndex('reactions_target_url_index')
    .ifNotExists()
    .on('reactions')
    .columns(['targetUrl'])
    .where('targetUrl', 'is not', null)
    .execute()

  // LINKS
  await db.schema
    .createTable('links')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.defaultTo(sql`generate_ulid()`).primaryKey()
    )
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('timestamp', 'timestamptz', (col) => col.notNull())
    .addColumn('deletedAt', 'timestamptz')
    .addColumn('prunedAt', 'timestamptz')
    .addColumn('fid', 'bigint', (col) => col.notNull())
    .addColumn('targetFid', 'bigint', (col) => col.notNull())
    .addColumn('displayTimestamp', 'timestamptz')
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('hash', 'bytea', (col) => col.notNull().unique())
    .execute()

  // VERIFICATIONS
  await db.schema
    .createTable('verifications')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.defaultTo(sql`generate_ulid()`).primaryKey()
    )
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('timestamp', 'timestamptz', (col) => col.notNull())
    .addColumn('deletedAt', 'timestamptz')
    .addColumn('fid', 'bigint', (col) => col.notNull())
    .addColumn('hash', 'bytea', (col) => col.notNull())
    .addColumn('signerAddress', 'bytea', (col) => col.notNull())
    .addColumn('blockHash', 'bytea', (col) => col.notNull())
    .addColumn('signature', 'bytea', (col) => col.notNull())
    .addUniqueConstraint('verifications_signer_address_fid_unique', [
      'signerAddress',
      'fid',
    ])
    .execute()

  await db.schema
    .createIndex('verifications_fid_timestamp_index')
    .ifNotExists()
    .on('verifications')
    .columns(['fid', 'timestamp'])
    .execute()

  // USER DATA
  await db.schema
    .createTable('userData')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.defaultTo(sql`generate_ulid()`).primaryKey()
    )
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('timestamp', 'timestamptz', (col) => col.notNull())
    .addColumn('deletedAt', 'timestamptz')
    .addColumn('fid', 'bigint', (col) => col.notNull())
    .addColumn('type', 'int2', (col) => col.notNull())
    .addColumn('hash', 'bytea', (col) => col.notNull().unique())
    .addColumn('value', 'text', (col) => col.notNull())
    .addUniqueConstraint('user_data_fid_type_unique', ['fid', 'type'])
    .execute()

  // FIDS -----------------------------------------------------------------------------------------
  await db.schema
    .createTable('fids')
    .addColumn('fid', 'bigint', (col) => col.notNull())
    .addPrimaryKeyConstraint('fids_pkey', ['fid'])
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('registeredAt', 'timestamptz', (col) => col.notNull())
    .addColumn('custodyAddress', 'bytea', (col) => col.notNull())
    .addColumn('recoveryAddress', 'bytea', (col) => col.notNull())
    .execute()

  // SIGNERS --------------------------------------------------------------------------------------
  await db.schema
    .createTable('signers')
    .addColumn('id', 'uuid', (col) => col.defaultTo(sql`generate_ulid()`))
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('addedAt', 'timestamptz', (col) => col.notNull())
    .addColumn('removedAt', 'timestamptz')
    .addColumn('fid', 'bigint', (col) => col.notNull())
    .addColumn('requesterFid', 'bigint', (col) => col.notNull())
    .addColumn('keyType', sql`smallint`, (col) => col.notNull())
    .addColumn('metadataType', sql`smallint`, (col) => col.notNull())
    .addColumn('key', 'bytea', (col) => col.notNull())
    .addColumn('metadata', 'json', (col) => col.notNull())
    .addUniqueConstraint('signers_fid_key_unique', ['fid', 'key'])
    .execute()

  await db.schema
    .createIndex('signers_fid_index')
    .on('signers')
    .column('fid')
    .execute()

  await db.schema
    .createIndex('signers_requester_fid_index')
    .on('signers')
    .column('requesterFid')
    .execute()

  // STORAGE ALLOCATIONS ---------------------------------------------------------------------------
  await db.schema
    .createTable('storage')
    .addColumn('id', 'uuid', (col) => col.defaultTo(sql`generate_ulid()`))
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('rentedAt', 'timestamptz', (col) => col.notNull())
    .addColumn('expiresAt', 'timestamptz', (col) => col.notNull())
    .addColumn('fid', 'bigint', (col) => col.notNull())
    .addColumn('units', sql`smallint`, (col) => col.notNull())
    .addColumn('payer', 'bytea', (col) => col.notNull())
    .addUniqueConstraint('storage_fid_expires_at_unique', ['fid', 'expiresAt'])
    .execute()

  await db.schema
    .createIndex('storage_fid_expires_at_index')
    .on('storage')
    .columns(['fid', 'expiresAt'])
    .execute()

  // HUBS
  await db.schema
    .createTable('hubs')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) =>
      col.defaultTo(sql`gen_random_uuid()`).primaryKey()
    )
    .addColumn('gossipAddress', 'text', (col) => col.notNull())
    .addColumn('rpcAddress', 'text', (col) => col.notNull())
    .addColumn('excludedHashes', sql`TEXT[]`, (col) => col.notNull())
    .addColumn('count', 'int4', (col) => col.notNull().defaultTo(0))
    .addColumn('hubVersion', 'text', (col) => col.notNull())
    .addColumn('network', 'text', (col) => col.notNull())
    .addColumn('appVersion', 'text', (col) => col.notNull())
    .addColumn('timestamp', 'int8', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .execute()
}

export const down = async (db: Kysely<any>) => {
  // Delete in reverse order of above so that foreign keys are not violated.
  await db.schema.dropTable('hubs').ifExists().execute()
  await db.schema.dropTable('userData').ifExists().execute()
  await db.schema.dropTable('verifications').ifExists().execute()
  await db.schema.dropTable('links').ifExists().execute()
  await db.schema.dropTable('reactions').ifExists().execute()
  await db.schema.dropTable('casts').ifExists().execute()
}
