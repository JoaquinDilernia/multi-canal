# Phase 1 – Tracking Foundation: Schema + Endpoint + Script

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la base del sistema — schema Postgres con Drizzle, endpoint `POST /api/touch` que clasifica y persiste toques de marketing, y el script de tracking JS para inyectar en las dos tiendas de Tienda Nube.

**Architecture:** La API Express maneja toda la captura de datos. La lógica de clasificación de canal (`detectCanal`) es una función pura aislada — sin dependencias de HTTP ni DB, fácil de testear. El script de tracking corre en el browser del visitante y hace POST al endpoint. La DB es Postgres en Railway, accedida via Drizzle ORM + postgres-js.

**Tech Stack:** Node 20, Express 4, Drizzle ORM, postgres-js, Vitest, supertest, TypeScript 5, tsx (dev runner)

---

## Prerequisitos (pasos manuales antes de correr cualquier tarea)

1. Crear proyecto en Railway (railway.app)
2. Agregar plugin Postgres al proyecto
3. Desde el panel del plugin, copiar el `DATABASE_URL` (formato: `postgresql://user:pass@host:5432/dbname`)
4. Tener ese string a mano — se pega en `api/.env` en la Tarea 1

---

## Estructura de archivos

```
Multi-Touch/
├── api/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts      # Tablas: visitors, touches, conversions
│   │   │   └── client.ts      # Singleton de Drizzle
│   │   ├── lib/
│   │   │   └── detect-canal.ts # Lógica pura de clasificación de canal
│   │   ├── routes/
│   │   │   └── touch.ts       # POST /api/touch
│   │   ├── index.ts           # Express app (exportada, sin side effects)
│   │   └── server.ts          # Entry point que llama app.listen()
│   ├── tests/
│   │   ├── detect-canal.test.ts
│   │   └── touch.test.ts
│   ├── drizzle/               # Migrations generadas por drizzle-kit
│   ├── drizzle.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── .env.example
└── tracking/
    └── touch.js               # Script vanilla JS para Tienda Nube
```

---

## Tarea 1: Scaffold de `api/`

**Archivos:**
- Crear: `api/package.json`
- Crear: `api/tsconfig.json`
- Crear: `api/vitest.config.ts`
- Crear: `api/.env.example`
- Crear: `api/.gitignore`

- [ ] **Paso 1: Crear directorios e instalar dependencias**

Desde la raíz del proyecto (`Multi-Touch/`), usando la terminal Bash:

```bash
mkdir -p api/src/db api/src/lib api/src/routes api/tests api/drizzle tracking
cd api
npm init -y
npm install express cors drizzle-orm postgres dotenv
npm install -D typescript tsx @types/express @types/node @types/cors drizzle-kit vitest supertest @types/supertest
```

- [ ] **Paso 2: Reemplazar sección "scripts" en `api/package.json`**

Abrir `api/package.json` y reemplazar el bloque `"scripts"` con:

```json
"scripts": {
  "dev": "tsx watch src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:generate": "drizzle-kit generate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio"
}
```

- [ ] **Paso 3: Crear `api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Paso 4: Crear `api/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Paso 5: Crear `api/.env.example`**

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
PORT=3000
ALLOWED_ORIGINS=https://tutienda.com.ar,https://mayorista.tutienda.com.ar
NODE_ENV=development
```

- [ ] **Paso 6: Crear `api/.env` con valores reales**

Copiar `.env.example` a `.env` y completar:
- `DATABASE_URL`: el string copiado de Railway en los Prerequisitos
- `PORT`: dejar como `3000`
- `ALLOWED_ORIGINS`: dejar vacío por ahora (en dev se permite cualquier origen)
- `NODE_ENV`: `development`

- [ ] **Paso 7: Crear `api/.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Paso 8: Init git y primer commit**

```bash
cd ..
git init
git add api/package.json api/tsconfig.json api/vitest.config.ts api/.env.example api/.gitignore
git commit -m "feat: scaffold api — Node/Express/Drizzle/Vitest"
```

---

## Tarea 2: Schema Drizzle

**Archivos:**
- Crear: `api/src/db/schema.ts`
- Crear: `api/drizzle.config.ts`

- [ ] **Paso 1: Crear `api/src/db/schema.ts`**

```typescript
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
    store: varchar('store', { length: 20 }).notNull(),
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
    store: varchar('store', { length: 20 }),
  },
  (table) => ({
    visitorIdIdx: index('conversions_visitor_id_idx').on(table.visitor_id),
    emailIdx: index('conversions_email_idx').on(table.email),
  })
);
```

- [ ] **Paso 2: Crear `api/drizzle.config.ts`**

```typescript
import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

- [ ] **Paso 3: Verificar que el schema compila**

```bash
cd api
npx tsc --noEmit
```

Esperado: sin output (cero errores).

- [ ] **Paso 4: Generar migrations y aplicarlas a Railway Postgres**

```bash
npm run db:generate
npm run db:push
```

`db:generate` crea `api/drizzle/0000_initial.sql` con los `CREATE TABLE`.
`db:push` aplica los cambios directamente al Postgres de Railway.

Esperado al final de `db:push`:
```
[✓] Changes applied
```

- [ ] **Paso 5: Commit**

```bash
cd ..
git add api/src/db/schema.ts api/drizzle.config.ts api/drizzle/
git commit -m "feat: drizzle schema — visitors, touches, conversions con índices"
```

---

## Tarea 3: Lógica de clasificación de canal (TDD)

**Archivos:**
- Crear: `api/tests/detect-canal.test.ts` (primero)
- Crear: `api/src/lib/detect-canal.ts` (después)

- [ ] **Paso 1: Escribir los tests que van a fallar**

Crear `api/tests/detect-canal.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectCanal } from '../src/lib/detect-canal';

describe('detectCanal', () => {
  it('detecta Meta via fbclid con campaña', () => {
    expect(detectCanal({ fbclid: 'abc123', utm_campaign: 'verano' }))
      .toEqual({ canal: 'meta', sub_canal: 'verano' });
  });

  it('detecta Meta via fbclid sin campaña', () => {
    expect(detectCanal({ fbclid: 'abc123' }))
      .toEqual({ canal: 'meta', sub_canal: null });
  });

  it('detecta Google via gclid', () => {
    expect(detectCanal({ gclid: 'xyz789', utm_campaign: 'marca' }))
      .toEqual({ canal: 'google', sub_canal: 'marca' });
  });

  it('detecta TikTok via ttclid', () => {
    expect(detectCanal({ ttclid: 'tt123' }))
      .toEqual({ canal: 'tiktok', sub_canal: null });
  });

  it('detecta Meta via utm_source=facebook', () => {
    expect(detectCanal({ utm_source: 'facebook', utm_campaign: 'retargeting' }))
      .toEqual({ canal: 'meta', sub_canal: 'retargeting' });
  });

  it('detecta Meta via utm_source=instagram', () => {
    expect(detectCanal({ utm_source: 'instagram', utm_campaign: 'stories' }))
      .toEqual({ canal: 'meta', sub_canal: 'stories' });
  });

  it('detecta Google via utm_source=google', () => {
    expect(detectCanal({ utm_source: 'google', utm_campaign: 'brand' }))
      .toEqual({ canal: 'google', sub_canal: 'brand' });
  });

  it('detecta email via utm_source=perfit', () => {
    expect(detectCanal({ utm_source: 'perfit', utm_campaign: 'newsletter-junio' }))
      .toEqual({ canal: 'email', sub_canal: 'newsletter-junio' });
  });

  it('detecta email via utm_source=email', () => {
    expect(detectCanal({ utm_source: 'email', utm_campaign: 'promo' }))
      .toEqual({ canal: 'email', sub_canal: 'promo' });
  });

  it('detecta referral via utm_source desconocido', () => {
    expect(detectCanal({ utm_source: 'mercadolibre' }))
      .toEqual({ canal: 'referral', sub_canal: 'mercadolibre' });
  });

  it('detecta organico via referrer de Google', () => {
    expect(detectCanal({ referrer: 'https://www.google.com/search?q=silla+madera' }))
      .toEqual({ canal: 'organico', sub_canal: 'www.google.com' });
  });

  it('detecta organico via referrer de Bing', () => {
    expect(detectCanal({ referrer: 'https://www.bing.com/search?q=mesa' }))
      .toEqual({ canal: 'organico', sub_canal: 'www.bing.com' });
  });

  it('detecta Meta via referrer de facebook', () => {
    expect(detectCanal({ referrer: 'https://www.facebook.com/' }))
      .toEqual({ canal: 'meta', sub_canal: null });
  });

  it('detecta referral via referrer desconocido', () => {
    expect(detectCanal({ referrer: 'https://decoracion.blog/recomendaciones' }))
      .toEqual({ canal: 'referral', sub_canal: 'decoracion.blog' });
  });

  it('retorna directo cuando no hay params ni referrer', () => {
    expect(detectCanal({}))
      .toEqual({ canal: 'directo', sub_canal: null });
  });

  it('fbclid tiene prioridad sobre utm_source', () => {
    expect(detectCanal({ fbclid: 'fb123', utm_source: 'google', utm_campaign: 'test' }))
      .toEqual({ canal: 'meta', sub_canal: 'test' });
  });

  it('gclid tiene prioridad sobre utm_source facebook', () => {
    expect(detectCanal({ gclid: 'g123', utm_source: 'facebook' }))
      .toEqual({ canal: 'google', sub_canal: null });
  });

  it('referrer inválido retorna directo', () => {
    expect(detectCanal({ referrer: 'not-a-url' }))
      .toEqual({ canal: 'directo', sub_canal: null });
  });
});
```

- [ ] **Paso 2: Correr tests — verificar que FALLAN**

```bash
cd api
npm test
```

Esperado: error `Cannot find module '../src/lib/detect-canal'`.
Esto confirma que los tests buscan el archivo que todavía no existe.

- [ ] **Paso 3: Implementar `api/src/lib/detect-canal.ts`**

```typescript
export type Canal = 'meta' | 'google' | 'tiktok' | 'email' | 'organico' | 'referral' | 'directo';

export interface TouchParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  epik?: string;
  referrer?: string;
}

export interface CanalResult {
  canal: Canal;
  sub_canal: string | null;
}

export function detectCanal(params: TouchParams): CanalResult {
  // Click IDs de plataformas pagas — máxima prioridad
  if (params.fbclid) return { canal: 'meta', sub_canal: params.utm_campaign ?? null };
  if (params.gclid) return { canal: 'google', sub_canal: params.utm_campaign ?? null };
  if (params.ttclid) return { canal: 'tiktok', sub_canal: params.utm_campaign ?? null };

  // UTMs explícitos
  if (params.utm_source) {
    const src = params.utm_source.toLowerCase();
    const campaign = params.utm_campaign ?? null;

    if (src.includes('facebook') || src.includes('instagram') || src.includes('meta')) {
      return { canal: 'meta', sub_canal: campaign };
    }
    if (src.includes('google')) {
      return { canal: 'google', sub_canal: campaign };
    }
    if (src.includes('tiktok')) {
      return { canal: 'tiktok', sub_canal: campaign };
    }
    if (src.includes('email') || src.includes('newsletter') || src.includes('perfit')) {
      return { canal: 'email', sub_canal: campaign };
    }
    return { canal: 'referral', sub_canal: params.utm_source };
  }

  // Inferir desde referrer
  if (!params.referrer) return { canal: 'directo', sub_canal: null };

  try {
    const refHost = new URL(params.referrer).hostname;

    if (refHost.includes('google.') || refHost.includes('bing.') || refHost.includes('yahoo.')) {
      return { canal: 'organico', sub_canal: refHost };
    }
    if (refHost.includes('facebook.com') || refHost.includes('instagram.com')) {
      return { canal: 'meta', sub_canal: null };
    }
    if (refHost.includes('tiktok.com')) {
      return { canal: 'tiktok', sub_canal: null };
    }
    return { canal: 'referral', sub_canal: refHost };
  } catch {
    return { canal: 'directo', sub_canal: null };
  }
}
```

- [ ] **Paso 4: Correr tests — verificar que PASAN**

```bash
npm test
```

Esperado:
```
✓ tests/detect-canal.test.ts (18 tests)
Test Files  1 passed (1)
Tests       18 passed (18)
```

- [ ] **Paso 5: Commit**

```bash
cd ..
git add api/src/lib/detect-canal.ts api/tests/detect-canal.test.ts
git commit -m "feat: canal detection logic con cobertura completa"
```

---

## Tarea 4: DB client

**Archivos:**
- Crear: `api/src/db/client.ts`

- [ ] **Paso 1: Crear `api/src/db/client.ts`**

```typescript
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 30,
});

export const db = drizzle(sql, { schema });
```

- [ ] **Paso 2: Verificar que compila**

```bash
cd api
npx tsc --noEmit
```

Esperado: sin output (cero errores).

- [ ] **Paso 3: Commit**

```bash
cd ..
git add api/src/db/client.ts
git commit -m "feat: drizzle db client singleton"
```

---

## Tarea 5: Express app

**Archivos:**
- Crear: `api/src/index.ts` (exporta `app`, sin side effects)
- Crear: `api/src/server.ts` (entry point, llama `app.listen`)

- [ ] **Paso 1: Crear `api/src/index.ts`**

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

export const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Si no hay ALLOWED_ORIGINS configurado, permitir todo (dev)
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origen no permitido: ${origin}`));
      }
    },
  })
);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});
```

- [ ] **Paso 2: Crear `api/src/server.ts`**

```typescript
import { app } from './index';

const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});
```

- [ ] **Paso 3: Arrancar en dev y verificar**

```bash
cd api
npm run dev
```

Esperado: `API corriendo en http://localhost:3000`

Abrir en browser: `http://localhost:3000/health`
Respuesta esperada: `{"ok":true,"ts":"2026-..."}`

Detener con Ctrl+C.

- [ ] **Paso 4: Commit**

```bash
cd ..
git add api/src/index.ts api/src/server.ts
git commit -m "feat: express app con CORS configurable y health endpoint"
```

---

## Tarea 6: Endpoint POST /api/touch (TDD)

**Archivos:**
- Crear: `api/tests/touch.test.ts` (primero)
- Crear: `api/src/routes/touch.ts` (después)
- Modificar: `api/src/index.ts` (registrar ruta)

- [ ] **Paso 1: Escribir los tests que van a fallar**

Crear `api/tests/touch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';

// Mock del cliente DB — debe estar antes del import de app
vi.mock('../src/db/client', () => {
  const makeChain = (): any => {
    const chain: any = {
      then: (res: any, rej: any) => Promise.resolve(undefined).then(res, rej),
      catch: (fn: any) => Promise.resolve(undefined).catch(fn),
      finally: (fn: any) => Promise.resolve(undefined).finally(fn),
    };
    chain.values = vi.fn(() => chain);
    chain.onConflictDoNothing = vi.fn(() => chain);
    return chain;
  };
  return {
    db: { insert: vi.fn(() => makeChain()) },
  };
});

import { app } from '../src/index';

const request = supertest(app);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/touch', () => {
  it('retorna 201 con toque Meta válido', async () => {
    const res = await request.post('/api/touch').send({
      visitor_id: 'test-vid-001',
      fbclid: 'abc123',
      utm_campaign: 'verano-2026',
      store: 'minorista',
      page_url: 'https://altorancho.com.ar/sillas',
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('retorna 201 con toque directo (sin params de canal)', async () => {
    const res = await request.post('/api/touch').send({
      visitor_id: 'test-vid-002',
      store: 'mayorista',
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('retorna 201 con toque Google via gclid', async () => {
    const res = await request.post('/api/touch').send({
      visitor_id: 'test-vid-003',
      gclid: 'gclid-xyz',
      utm_campaign: 'brand',
      store: 'minorista',
    });
    expect(res.status).toBe(201);
  });

  it('retorna 400 cuando falta visitor_id', async () => {
    const res = await request.post('/api/touch').send({
      store: 'minorista',
      fbclid: 'abc',
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('retorna 400 cuando visitor_id no es string', async () => {
    const res = await request.post('/api/touch').send({
      visitor_id: 12345,
      store: 'minorista',
    });
    expect(res.status).toBe(400);
  });

  it('retorna 400 cuando store es inválido', async () => {
    const res = await request.post('/api/touch').send({
      visitor_id: 'test-vid-004',
      store: 'invalido',
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('retorna 400 cuando store está ausente', async () => {
    const res = await request.post('/api/touch').send({
      visitor_id: 'test-vid-005',
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Paso 2: Correr tests — verificar que FALLAN**

```bash
cd api
npm test
```

Esperado: los tests de `/api/touch` fallan con 404 (la ruta no existe todavía).

- [ ] **Paso 3: Implementar `api/src/routes/touch.ts`**

```typescript
import { Router } from 'express';
import { db } from '../db/client';
import { visitors, touches } from '../db/schema';
import { detectCanal, type TouchParams } from '../lib/detect-canal';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const {
      visitor_id,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbclid, gclid, ttclid, epik,
      referrer, page_url, store,
    } = req.body;

    if (!visitor_id || typeof visitor_id !== 'string') {
      return res.status(400).json({ error: 'visitor_id requerido y debe ser string' });
    }

    if (!store || !['mayorista', 'minorista'].includes(store)) {
      return res.status(400).json({ error: 'store debe ser "mayorista" o "minorista"' });
    }

    const params: TouchParams = {
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbclid, gclid, ttclid, epik, referrer,
    };

    const { canal, sub_canal } = detectCanal(params);

    await db.insert(visitors).values({ id: visitor_id }).onConflictDoNothing();

    await db.insert(touches).values({
      visitor_id,
      canal,
      sub_canal: sub_canal ?? null,
      raw_params: params,
      page_url: page_url ?? null,
      store,
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[touch] Error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
```

- [ ] **Paso 4: Registrar la ruta en `api/src/index.ts`**

El archivo completo queda así (agregar el import y `app.use` al final):

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import touchRouter from './routes/touch';

export const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origen no permitido: ${origin}`));
      }
    },
  })
);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use('/api/touch', touchRouter);
```

- [ ] **Paso 5: Correr tests — verificar que PASAN**

```bash
npm test
```

Esperado:
```
✓ tests/detect-canal.test.ts (18 tests)
✓ tests/touch.test.ts (7 tests)
Test Files  2 passed (2)
Tests       25 passed (25)
```

- [ ] **Paso 6: Commit**

```bash
cd ..
git add api/src/routes/touch.ts api/src/index.ts api/tests/touch.test.ts
git commit -m "feat: POST /api/touch con detección de canal y persistencia en Postgres"
```

---

## Tarea 7: Script de tracking para Tienda Nube

**Archivos:**
- Crear: `tracking/touch.js`

- [ ] **Paso 1: Crear `tracking/touch.js`**

```javascript
/**
 * Altorancho Multi-Touch Attribution Tracker v1
 *
 * Instalación en Tienda Nube:
 * Admin → Personalización → Scripts/HTML personalizado → agregar al <head>
 *
 * Cambiar las dos constantes de configuración según la tienda:
 *   API_URL → URL del deploy en Railway (ej. https://xxx.railway.app/api/touch)
 *   STORE   → 'minorista' o 'mayorista'
 */
(function () {
  'use strict';

  var API_URL = 'https://TU-API.railway.app/api/touch'; // ← cambiar por URL de Railway
  var STORE = 'minorista'; // ← cambiar a 'mayorista' en la otra tienda
  var VISITOR_KEY = 'at_vid';
  var SESSION_KEY = 'at_session';

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function getOrCreateVisitorId() {
    var id = null;

    try {
      id = localStorage.getItem(VISITOR_KEY);
    } catch (e) {}

    // Fallback a cookie si localStorage no está disponible
    if (!id) {
      var match = document.cookie.match(new RegExp('(?:^|; )' + VISITOR_KEY + '=([^;]*)'));
      if (match) id = decodeURIComponent(match[1]);
    }

    if (!id) {
      id = generateUUID();
      try {
        localStorage.setItem(VISITOR_KEY, id);
      } catch (e) {}
      var expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);
      document.cookie =
        VISITOR_KEY + '=' + encodeURIComponent(id) +
        '; expires=' + expires.toUTCString() +
        '; path=/; SameSite=Lax';
    }

    return id;
  }

  function isNewSession() {
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, '1');
        return true;
      }
      return false;
    } catch (e) {
      return true;
    }
  }

  function getParam(name) {
    try {
      return new URL(window.location.href).searchParams.get(name) || undefined;
    } catch (e) {
      return undefined;
    }
  }

  function sendTouch(visitorId, params) {
    var payload = {
      visitor_id: visitorId,
      store: STORE,
      page_url: window.location.href,
      utm_source: params.utm_source,
      utm_medium: params.utm_medium,
      utm_campaign: params.utm_campaign,
      utm_content: params.utm_content,
      utm_term: params.utm_term,
      fbclid: params.fbclid,
      gclid: params.gclid,
      ttclid: params.ttclid,
      epik: params.epik,
      referrer: params.referrer,
    };

    var body = JSON.stringify(payload);

    if (typeof navigator.sendBeacon === 'function') {
      // sendBeacon con Blob asegura Content-Type: application/json
      var blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(API_URL, blob);
    } else {
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(function () {});
    }
  }

  // Solo registrar toque si hay señal de canal pagado O si es inicio de sesión nueva
  var hasPaidSignal =
    getParam('fbclid') ||
    getParam('gclid') ||
    getParam('ttclid') ||
    getParam('epik') ||
    getParam('utm_source');

  if (!hasPaidSignal && !isNewSession()) {
    return;
  }

  var params = {
    utm_source: getParam('utm_source'),
    utm_medium: getParam('utm_medium'),
    utm_campaign: getParam('utm_campaign'),
    utm_content: getParam('utm_content'),
    utm_term: getParam('utm_term'),
    fbclid: getParam('fbclid'),
    gclid: getParam('gclid'),
    ttclid: getParam('ttclid'),
    epik: getParam('epik'),
    referrer: document.referrer || undefined,
  };

  sendTouch(getOrCreateVisitorId(), params);
})();
```

- [ ] **Paso 2: Commit**

```bash
git add tracking/touch.js
git commit -m "feat: tracking script vanilla JS para inyectar en Tienda Nube"
```

---

## Tarea 8: Smoke test E2E manual

Verifica que el flujo completo funciona: script → API → Postgres.

- [ ] **Paso 1: Arrancar la API en dev**

```bash
cd api
npm run dev
```

Esperado: `API corriendo en http://localhost:3000`

- [ ] **Paso 2: Enviar un toque de prueba**

En otra terminal (Bash):

```bash
curl -X POST http://localhost:3000/api/touch \
  -H "Content-Type: application/json" \
  -d '{
    "visitor_id": "smoke-test-001",
    "utm_source": "facebook",
    "utm_campaign": "verano-2026",
    "store": "minorista",
    "page_url": "http://localhost/test"
  }'
```

Esperado: `{"ok":true}`

- [ ] **Paso 3: Verificar en la DB con Drizzle Studio**

```bash
npm run db:studio
```

Abre Drizzle Studio en el browser. Ir a tabla `touches` — debe aparecer la fila con:
- `canal: "meta"`
- `sub_canal: "verano-2026"`
- `visitor_id: "smoke-test-001"`
- `store: "minorista"`

- [ ] **Paso 4: Simular el script desde DevTools del browser**

Abrir cualquier página en el browser, abrir DevTools → Console y pegar:

```javascript
fetch('http://localhost:3000/api/touch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    visitor_id: 'browser-test-001',
    fbclid: 'test-fb-click',
    utm_campaign: 'browser-smoke',
    store: 'minorista',
    page_url: window.location.href,
    referrer: document.referrer
  })
}).then(r => r.json()).then(console.log);
```

Esperado: `{ok: true}` en consola + nueva fila en Drizzle Studio con `canal: "meta"`.

- [ ] **Paso 5: Commit de cierre de Phase 1**

```bash
cd ..
git commit --allow-empty -m "chore: Phase 1 smoke tested — touches persisten correctamente en Postgres"
```

---

## Cobertura del spec

- [x] `visitor_id` generado y persistido en localStorage + cookie larga duración
- [x] UTMs capturados: utm_source, utm_medium, utm_campaign, utm_content, utm_term
- [x] Click IDs: fbclid (Meta), gclid (Google), ttclid (TikTok), epik (Pinterest)
- [x] Fallback a `document.referrer` cuando no hay UTMs ni click IDs
- [x] Endpoint Express persiste en Postgres
- [x] `visitors` con upsert (no duplica)
- [x] `touches` con todos los campos del spec + índices para queries del Sankey
- [x] `conversions` creada y lista para Phase 2 (webhook TN)
- [x] No se registran page views redundantes dentro de la misma sesión
- [x] Drizzle elegido (justificado en conversación vs Prisma vs SQL puro)
- [ ] Deploy a Railway — siguiente paso antes de Phase 2
