import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 30,
});

export const db = drizzle(sql, { schema });
