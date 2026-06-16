import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import touchRouter from './routes/touch';
import conversionRouter from './routes/conversion';
import tnWebhookRouter from './routes/webhooks/tiendanube';
import perfitWebhookRouter from './routes/webhooks/perfit';
import dashboardRouter from './routes/dashboard';

export const app = express();

// Static files before CORS — assets no necesitan CORS check
app.use(express.static(path.join(__dirname, '..', 'public')));

const allowedOrigins = [
  ...(process.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
  // Railway inyecta RAILWAY_PUBLIC_DOMAIN automáticamente — permite que el dashboard
  // llame a la API desde el mismo dominio sin configuración manual extra
  ...(process.env.RAILWAY_PUBLIC_DOMAIN
    ? [`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`]
    : []),
];

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
app.use('/api/webhooks/perfit', perfitWebhookRouter);
app.use('/api/dashboard', dashboardRouter);
