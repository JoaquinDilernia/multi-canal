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
      referrer, page_url,
    } = req.body;

    if (!visitor_id || typeof visitor_id !== 'string') {
      return res.status(400).json({ error: 'visitor_id requerido y debe ser string' });
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
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[touch] Error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
