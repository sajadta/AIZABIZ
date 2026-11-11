import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';
dotenv.config();

export const isPostgresConfigured = Boolean(
  (process.env.SQL_HOST && process.env.SQL_HOST !== 'localhost' && process.env.SQL_HOST !== '127.0.0.1') ||
  process.env.DATABASE_URL
);

let db: any;
try {
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

  pool.on('error', (err) => {
    console.warn('[AI Studio] Database pool error:', err.message);
  });

  db = drizzle(pool, { schema });
} catch (e) {
  console.warn('[AI Studio] Database connection failed, using mock');
  const noOp = { 
    findMany: async () => [], 
    findFirst: async () => null,
    findUnique: async () => null, 
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {}, 
    delete: async () => ({}),
    select: () => ({ from: () => ({ orderBy: () => ({ limit: () => [] }) }) }),
    insert: () => ({ values: () => ({ returning: () => [] }) }),
    query: new Proxy({}, { get: () => ({ findMany: async () => [], findFirst: async () => null }) })
  };
  db = new Proxy({}, {
    get: (_, prop) => {
      if (prop === 'query') return noOp.query;
      if (prop === 'select') return noOp.select;
      if (prop === 'delete') return noOp.delete;
      if (prop === 'insert') return noOp.insert;
      if (typeof noOp[prop as keyof typeof noOp] === 'function') return noOp[prop as keyof typeof noOp];
      return async () => [];
    },
  });
}

export { db };

