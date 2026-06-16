import { Router } from 'express';
import { eq, desc, gte } from 'drizzle-orm';
import { db } from '../../db/client';
import { conversions, conversion_sessions } from '../../db/schema';
import { getTNOrder } from '../../lib/tiendanube';

const router = Router();

router.post('/', async (req, res) => {
  // TN espera respuesta rápida — respondemos inmediatamente y procesamos async
  res.status(200).json({ ok: true });

  try {
    const { event, id: orderId } = req.body;

    if (event !== 'order/paid' || !orderId) return;

    const order = await getTNOrder(orderId);
    const email = order.customer?.email ?? null;
    const monto = order.total ?? null;

    // Buscar la intención de conversión registrada desde el browser (última hora)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sessions = await db
      .select()
      .from(conversion_sessions)
      .where(gte(conversion_sessions.created_at, oneHourAgo))
      .orderBy(desc(conversion_sessions.created_at))
      .limit(1);

    const visitor_id = sessions.length > 0 ? sessions[0].visitor_id : null;

    // Limpiar la sesión usada
    if (sessions.length > 0) {
      await db.delete(conversion_sessions).where(eq(conversion_sessions.id, sessions[0].id));
    }

    await db.insert(conversions).values({
      order_id: String(orderId),
      visitor_id,
      email,
      monto,
    }).onConflictDoNothing();

    console.log(`[webhook/tn] order/paid ${orderId} → visitor=${visitor_id ?? 'sin match'} email=${email}`);
  } catch (err) {
    console.error('[webhook/tn] Error:', err);
  }
});

export default router;
