import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import touchRouter from './routes/touch';
import conversionRouter from './routes/conversion';
import tnWebhookRouter from './routes/webhooks/tiendanube';

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
app.use('/api/conversion', conversionRouter);
app.use('/api/webhooks/tiendanube', tnWebhookRouter);
