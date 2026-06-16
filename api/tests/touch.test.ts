import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';

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
  it('retorna 201 con toque Meta valido', async () => {
    const res = await request.post('/api/touch').send({
      visitor_id: 'test-vid-001',
      fbclid: 'abc123',
      utm_campaign: 'verano-2026',
      page_url: 'https://altorancho.com.ar/sillas',
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('retorna 201 con toque directo (sin params de canal)', async () => {
    const res = await request.post('/api/touch').send({
      visitor_id: 'test-vid-002',
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('retorna 201 con toque Google via gclid', async () => {
    const res = await request.post('/api/touch').send({
      visitor_id: 'test-vid-003',
      gclid: 'gclid-xyz',
      utm_campaign: 'brand',
    });
    expect(res.status).toBe(201);
  });

  it('retorna 201 con toque organico via referrer', async () => {
    const res = await request.post('/api/touch').send({
      visitor_id: 'test-vid-004',
      referrer: 'https://www.google.com/search?q=silla+madera',
    });
    expect(res.status).toBe(201);
  });

  it('retorna 400 cuando falta visitor_id', async () => {
    const res = await request.post('/api/touch').send({
      fbclid: 'abc',
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('retorna 400 cuando visitor_id no es string', async () => {
    const res = await request.post('/api/touch').send({
      visitor_id: 12345,
    });
    expect(res.status).toBe(400);
  });
});
