// c:\Users\mille\Documents\otogami\server\db\schema\users.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

export const users = sqliteTable('users', {
  userId: text('user_id').primaryKey().$defaultFn(() => uuidv7()),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  verified: integer('verified').default(0).notNull(),
  passwordHash: text('password_hash').notNull(),
  loginAttempts: integer('login_attempts').default(0).notNull(),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
