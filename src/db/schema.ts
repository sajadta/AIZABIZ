import {
  pgTable,
  serial,
  text,
  doublePrecision,
  timestamp,
  varchar,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';

export const tradeHistory = pgTable('trade_history', {
  id: serial('id').primaryKey(),
  tradeId: varchar('trade_id', { length: 255 }).notNull(),
  symbol: varchar('symbol', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  buyPrice: doublePrecision('buy_price').notNull(),
  sellPrice: doublePrecision('sell_price'),
  quantity: integer('quantity').notNull(),
  realizedPnL: doublePrecision('realized_pnl'),
  brokerageCharges: doublePrecision('brokerage_charges'),
  netRealizedPnL: doublePrecision('net_realized_pnl'),
  exitReason: text('exit_reason'),
  highestLTP: doublePrecision('highest_ltp'),
  highestPnl: doublePrecision('highest_pnl'),
  highestNetPnl: doublePrecision('highest_net_pnl'),
  mode: varchar('mode', { length: 50 }).default('PAPER_TRADING'),
  openedAtMs: varchar('opened_at_ms', { length: 50 }),
  openTime: timestamp('open_time').defaultNow().notNull(),
  closeTime: timestamp('close_time'),
});

export const appState = pgTable('app_state', {
  id: varchar('id', { length: 50 }).primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
