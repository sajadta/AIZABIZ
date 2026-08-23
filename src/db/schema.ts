import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, doublePrecision } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  upstoxApiKey: text('upstox_api_key'),
  upstoxRedirectUri: text('upstox_redirect_uri'),
  upstoxAccessToken: text('upstox_access_token'),
  botConfig: text('bot_config'),
  telegramToken: text('telegram_token'),
  telegramChatId: text('telegram_chat_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const paperOrders = pgTable('paper_orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  symbol: text('symbol').notNull(),
  instrumentKey: text('instrument_key').notNull(),
  quantity: integer('quantity').notNull(),
  transactionType: text('transaction_type').notNull(), // BUY / SELL
  price: doublePrecision('price').notNull(),
  status: text('status').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  paperOrders: many(paperOrders),
}));

export const paperOrdersRelations = relations(paperOrders, ({ one }) => ({
  user: one(users, {
    fields: [paperOrders.userId],
    references: [users.id],
  }),
}));
