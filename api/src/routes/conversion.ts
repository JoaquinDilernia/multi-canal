import { Router } from 'express';
import { db } from '../db/client';
import { visitors, conversion_sessions } from '../db/schema';

const router = Router();

// Recibe el evento de conversión desde el browser cuando el cliente llega a la success page.
// No tiene order_id todavía — eso llega por el webhook de TN.
router.post('/track', async (req, res) => {
  try {
    const { visitor_id } = req.body;

    if (!visitor_id || typeof visitor_id !== 'string') {
      return res.status(400).json({ error: 'visitor_id requerido' });
    }

    await db.insert(visitors).values({ id: visitor_id }).onConflictDoNothing();
    await db.insert(conversion_sessions).values({ visitor_id });

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[conversion/track] Error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
