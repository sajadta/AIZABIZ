import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';
dotenv.config();

export const isPostgresConfigured = Boolean(
  (process.env.SQL_HOST && process.env.SQL_HOST !== 'localhost' && process.env.SQL_HOST !== '127.0.0.1') ||
  process.env.DATABASE_URL
);

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      }
    : {
        host: process.env.SQL_HOST || 'localhost',
        user: process.env.SQL_USER || 'postgres',
        password: process.env.SQL_PASSWORD || '',
        database: process.env.SQL_DB_NAME || 'postgres',
        ssl: false,
      }
);

pool.on('error', () => {
  // Handled gracefully by fallback storage
});

export const db = drizzle(pool, { schema });
