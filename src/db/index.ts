import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

function getConnectionString(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    undefined
  );
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.SQL_HOST || getConnectionString());
}

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = getConnectionString();
    const useConnectionString = !process.env.SQL_HOST && Boolean(connectionString);
    global._postgresPool = new Pool(
      useConnectionString
        ? {
            connectionString,
            ssl: { rejectUnauthorized: false },
            max: 10,
            connectionTimeoutMillis: 8000,
          }
        : {
            host: process.env.SQL_HOST,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            database: process.env.SQL_DB_NAME,
            ...(process.env.SQL_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
            max: 10,
            connectionTimeoutMillis: 8000,
          }
    );

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
