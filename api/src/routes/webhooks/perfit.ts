import { Router } from 'express';
import { db } from '../../db/client';
import { perfit_events } from '../../db/schema';

const router = Router();

router.post('/', async (req, res) => {
  res.status(200).json({ ok: true });

  try {
    const body = req.body;

    // Perfit puede mandar el email en distintos lugares según la versión del webhook
    const email: string | undefined =
      body.email ?? body.contact?.email ?? body.recipient;

    const eventType: string | undefined =
      body.event ?? body.type ?? body.eventType;

    if (!email || typeof email !== 'string') {
      console.warn('[webhook/perfit] Payload sin email:', JSON.stringify(body));
      return;
    }

    // Solo nos interesan los clicks para atribución (opens son ruido)
    if (eventType && eventType !== 'click') {
      return;
    }

    const campaignName: string | undefined =
      body.campaign?.name ??
      body.campaignName ??
      body.campaign_name ??
      body.campaign?.subject;

    await db.insert(perfit_events).values({
      email: email.toLowerCase().trim(),
      campaign_name: campaignName ?? null,
      event_type: eventType ?? 'click',
      raw_payload: body,
    });

    console.log(`[webhook/perfit] click ${email} → ${campaignName ?? '(sin campaña)'}`);
  } catch (err) {
    console.error('[webhook/perfit] Error:', err);
  }
});

export default router;
