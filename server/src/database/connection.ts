import knex, { Knex } from 'knex';
import path from 'path';
import { env } from '../config/env.js';

let db: Knex;

export function getDatabase(): Knex {
  if (!db) {
    const config: Knex.Config = env.isSqlite
      ? {
          client: 'better-sqlite3',
          connection: {
            filename: path.resolve(env.sqlitePath),
          },
          useNullAsDefault: true,
        }
      : {
          client: 'pg',
          connection: env.databaseUrl,
        };

    db = knex(config);
  }
  return db;
}

export async function runMigrations(): Promise<void> {
  const database = getDatabase();
  const migrationFiles = [
    '001_create_buffers',
    '002_create_windows',
    '003_create_messages',
    '004_create_waiting_messages',
    '005_create_logs',
  ];

  const hasTable = await database.schema.hasTable('_migrations');
  if (!hasTable) {
    await database.schema.createTable('_migrations', (table) => {
      table.string('name').primary();
      table.dateTime('run_at').defaultTo(database.fn.now());
    });
  }

  for (const migration of migrationFiles) {
    const alreadyRun = await database('_migrations').where({ name: migration }).first();
    if (alreadyRun) continue;

    switch (migration) {
      case '001_create_buffers':
        await createBuffersTable(database);
        break;
      case '002_create_windows':
        await createWindowsTable(database);
        break;
      case '003_create_messages':
        await createMessagesTable(database);
        break;
      case '004_create_waiting_messages':
        await createWaitingMessagesTable(database);
        break;
      case '005_create_logs':
        await createLogsTable(database);
        break;
    }

    await database('_migrations').insert({ name: migration });
  }
}

async function createBuffersTable(database: Knex): Promise<void> {
  await database.schema.createTable('buffers', (table) => {
    table.string('id').primary();
    table.string('name').notNullable();
    table.integer('window_time').notNullable();
    table.string('webhook_url').notNullable();
    table.integer('max_concurrent_windows').nullable();
    table.string('api_key').notNullable().unique();
    table.dateTime('created_at').notNullable();
    table.dateTime('updated_at').notNullable();
  });
}

async function createWindowsTable(database: Knex): Promise<void> {
  await database.schema.createTable('windows', (table) => {
    table.string('id').primary();
    table.string('buffer_id').notNullable().references('id').inTable('buffers').onDelete('CASCADE');
    table.string('identifier').notNullable();
    table.string('status').notNullable().defaultTo('open');
    table.dateTime('expires_at').notNullable();
    table.dateTime('created_at').notNullable();
  });
}

async function createMessagesTable(database: Knex): Promise<void> {
  await database.schema.createTable('messages', (table) => {
    table.string('id').primary();
    table.string('window_id').notNullable().references('id').inTable('windows').onDelete('CASCADE');
    table.string('buffer_id').notNullable();
    table.string('identifier').notNullable();
    table.text('content').notNullable();
    table.string('type').notNullable();
    table.dateTime('received_at').notNullable();
  });
}

async function createWaitingMessagesTable(database: Knex): Promise<void> {
  await database.schema.createTable('waiting_messages', (table) => {
    table.string('id').primary();
    table.string('buffer_id').notNullable().references('id').inTable('buffers').onDelete('CASCADE');
    table.string('identifier').notNullable();
    table.text('content').notNullable();
    table.string('type').notNullable();
    table.dateTime('received_at').notNullable();
  });
}

async function createLogsTable(database: Knex): Promise<void> {
  await database.schema.createTable('logs', (table) => {
    table.string('id').primary();
    table.string('buffer_id').notNullable().references('id').inTable('buffers').onDelete('CASCADE');
    table.string('window_id').nullable();
    table.string('identifier').notNullable();
    table.text('webhook_payload').notNullable();
    table.integer('webhook_response_status').nullable();
    table.text('webhook_response_body').nullable();
    table.dateTime('created_at').notNullable();
  });
}
