import {
  pgTable,
  varchar,
  serial,
  timestamp,
  jsonb,
  text,
  numeric,
  index,
} from 'drizzle-orm/pg-core';

export const visitors = pgTable('visitors', {
  id: varchar('id', { length: 36 }).primaryKey(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const touches = pgTable(
  'touches',
  {
    id: serial('id').primaryKey(),
    visitor_id: varchar('visitor_id', { length: 36 })
      .references(() => visitors.id)
      .notNull(),
    canal: varchar('canal', { length: 50 }).notNull(),
    sub_canal: varchar('sub_canal', { length: 255 }),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    raw_params: jsonb('raw_params'),
    page_url: text('page_url'),
  },
  (table) => ({
    visitorIdIdx: index('touches_visitor_id_idx').on(table.visitor_id),
    timestampIdx: index('touches_timestamp_idx').on(table.timestamp),
    visitorTimestampIdx: index('touches_visitor_timestamp_idx').on(
      table.visitor_id,
      table.timestamp
    ),
  })
);

export const conversions = pgTable(
  'conversions',
  {
    id: serial('id').primaryKey(),
    order_id: varchar('order_id', { length: 100 }).notNull().unique(),
    visitor_id: varchar('visitor_id', { length: 36 }).references(() => visitors.id),
    email: varchar('email', { length: 255 }),
    monto: numeric('monto', { precision: 10, scale: 2 }),
    fecha: timestamp('fecha').defaultNow().notNull(),
  },
  (table) => ({
    visitorIdIdx: index('conversions_visitor_id_idx').on(table.visitor_id),
    emailIdx: index('conversions_email_idx').on(table.email),
  })
);
