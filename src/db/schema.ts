import { pgTable, serial, text, doublePrecision, timestamp, varchar, integer } from 'drizzle-orm/pg-core';

export const tradeHistory = pgTable('trade_history', {
  id: serial('id').primaryKey(),
  tradeId: varchar('trade_id', { length: 255 }).notNull(),
  symbol: varchar('symbol', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  buyPrice: doublePrecision('buy_price').notNull(),
  sellPrice: doublePrecision('sell_price'),
  quantity: integer('quantity').notNull(),
  realizedPnL: doublePrecision('realized_pnl'),
  openTime: timestamp('open_time').defaultNow().notNull(),
  closeTime: timestamp('close_time'),
});

import { jsonb } from 'drizzle-orm/pg-core';
export const appState = pgTable('app_state', {
  id: varchar('id', { length: 50 }).primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
