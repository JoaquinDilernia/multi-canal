import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/client';

const router = Router();

const CANAL_LABELS: Record<string, string> = {
  meta: 'Meta',
  google: 'Google',
  email: 'Email',
  tiktok: 'TikTok',
  organico: 'Orgánico',
  directo: 'Directo',
  referral: 'Referral',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_POS = 5;

router.get('/sankey', async (req, res) => {
  try {
    const desde =
      typeof req.query.desde === 'string' && DATE_RE.test(req.query.desde)
        ? req.query.desde
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const hasta =
      typeof req.query.hasta === 'string' && DATE_RE.test(req.query.hasta)
        ? req.query.hasta
        : new Date().toISOString().slice(0, 10);

    // Touches por conversión (hasta 5)
    const touchRows = (await db.execute(sql`
      WITH ranked AS (
        SELECT
          c.id          AS cid,
          t.canal,
          ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY t.timestamp) AS pos
        FROM conversions c
        JOIN touches t
          ON t.visitor_id = c.visitor_id
         AND t.timestamp <= c.fecha
        WHERE c.fecha::date BETWEEN ${desde}::date AND ${hasta}::date
          AND c.visitor_id IS NOT NULL
      )
      SELECT cid, canal, pos::int AS pos
      FROM ranked
      WHERE pos <= ${MAX_POS - 1}
      ORDER BY cid, pos
    `)) as unknown as Array<{ cid: number; canal: string; pos: number }>;

    // Email-only vía Perfit
    const perfitRows = (await db.execute(sql`
      SELECT DISTINCT ON (c.id)
        c.id AS cid, pe.campaign_name
      FROM conversions c
      JOIN perfit_events pe
        ON LOWER(pe.email) = LOWER(c.email)
       AND pe.created_at <= c.fecha
       AND pe.created_at > c.fecha - INTERVAL '7 days'
      WHERE c.visitor_id IS NULL
        AND c.email IS NOT NULL
        AND c.fecha::date BETWEEN ${desde}::date AND ${hasta}::date
      ORDER BY c.id, pe.created_at DESC
    `)) as unknown as Array<{ cid: number; campaign_name: string | null }>;

    // Monto por conversión
    const montoRows = (await db.execute(sql`
      SELECT id::int AS cid, COALESCE(monto::float, 0) AS monto
      FROM conversions
      WHERE fecha::date BETWEEN ${desde}::date AND ${hasta}::date
    `)) as unknown as Array<{ cid: number; monto: number }>;

    const montoMap = new Map<number, number>();
    for (const r of montoRows) montoMap.set(r.cid, r.monto);

    // Totales resumen
    const [summary] = (await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(monto::numeric), 0)::float AS monto_total
      FROM conversions
      WHERE fecha::date BETWEEN ${desde}::date AND ${hasta}::date
    `)) as unknown as Array<{ total: number; monto_total: number }>;

    // Construir journeys map: cid -> canal[]
    const journeys = new Map<number, string[]>();
    for (const row of touchRows) {
      if (!journeys.has(row.cid)) journeys.set(row.cid, []);
      journeys.get(row.cid)!.push(row.canal);
    }
    for (const row of perfitRows) {
      if (!journeys.has(row.cid)) journeys.set(row.cid, ['email']);
    }

    // Construir nodos por columna y flows
    // nodeKey: `${pos}|${canal}` -> { count, revenue }
    type NodeKey = string;
    const nodeData = new Map<NodeKey, { count: number; revenue: number; isCompra: boolean }>();
    const flowCounts = new Map<string, number>();
    const totalAtrib = journeys.size;

    for (const [cid, canales] of journeys) {
      const monto = montoMap.get(cid) ?? 0;
      // compra aparece en la posición siguiente al último toque (max MAX_POS)
      const compraPos = Math.min(canales.length + 1, MAX_POS);

      // nodos de touch
      for (let i = 0; i < canales.length && i < MAX_POS - 1; i++) {
        const key = `${i + 1}|${canales[i]}`;
        const e = nodeData.get(key) ?? { count: 0, revenue: 0, isCompra: false };
        nodeData.set(key, { ...e, count: e.count + 1 });
      }

      // nodo compra
      const cKey = `${compraPos}|compra`;
      const ec = nodeData.get(cKey) ?? { count: 0, revenue: 0, isCompra: true };
      nodeData.set(cKey, { count: ec.count + 1, revenue: ec.revenue + monto, isCompra: true });

      // flows
      const seq = [...canales.slice(0, MAX_POS - 1), 'compra'];
      for (let i = 0; i < seq.length - 1; i++) {
        if (i >= MAX_POS - 1) break;
        const fk = `${i + 1}|${seq[i]}>${i + 2}|${seq[i + 1]}`;
        flowCounts.set(fk, (flowCounts.get(fk) ?? 0) + 1);
      }
    }

    // Agrupar por columna
    const colMap = new Map<number, Array<{ canal: string; count: number; revenue: number; isCompra: boolean }>>();
    for (const [key, data] of nodeData) {
      const [pStr, canal] = key.split('|');
      const pos = parseInt(pStr);
      if (!colMap.has(pos)) colMap.set(pos, []);
      colMap.get(pos)!.push({ canal, ...data });
    }

    const columns = [...colMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([pos, channels]) => {
        // ordenar: compra primero, luego por count desc
        channels.sort((a, b) => {
          if (a.isCompra && !b.isCompra) return -1;
          if (!a.isCompra && b.isCompra) return 1;
          return b.count - a.count;
        });
        return {
          position: pos,
          label: pos === MAX_POS ? `TOQUE ${pos}+` : `TOQUE ${pos}`,
          channels: channels.map((ch) => ({
            canal: ch.canal,
            label: ch.isCompra ? 'Compra' : (CANAL_LABELS[ch.canal] ?? ch.canal),
            count: ch.count,
            revenue: ch.revenue,
            isCompra: ch.isCompra,
            pct: ch.isCompra && totalAtrib > 0
              ? Math.round((ch.count / totalAtrib) * 100)
              : undefined,
          })),
          total_revenue: channels.filter(c => c.isCompra).reduce((s, c) => s + c.revenue, 0),
        };
      });

    const flows = [...flowCounts.entries()].map(([key, count]) => {
      const [from, to] = key.split('>');
      const [fromPos, fromCanal] = from.split('|');
      const [toPos, toCanal] = to.split('|');
      return { fromPos: parseInt(fromPos), fromCanal, toPos: parseInt(toPos), toCanal, count };
    });

    res.json({
      columns,
      flows,
      summary: {
        total: summary?.total ?? 0,
        atribuidas: totalAtrib,
        sin_atribucion: (summary?.total ?? 0) - totalAtrib,
        monto_total: summary?.monto_total ?? 0,
      },
    });
  } catch (err) {
    console.error('[dashboard/sankey] Error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
