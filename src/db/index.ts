import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.SQL_HOST || 'localhost',
  user: process.env.SQL_USER || 'postgres',
  password: process.env.SQL_PASSWORD || '',
  database: process.env.SQL_DB_NAME || 'postgres',
  ssl: false,
});

pool.on('error', (err) => {
  console.warn('Postgres Pool Warning (Non-Fatal):', err.message);
});

export const db = drizzle(pool, { schema });
