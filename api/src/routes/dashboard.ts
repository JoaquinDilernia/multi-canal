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

const CANAL_COLORS: Record<string, string> = {
  meta: '#1877F2',
  google: '#EA4335',
  email: '#F59E0B',
  tiktok: '#FF0050',
  organico: '#10B981',
  directo: '#94A3B8',
  referral: '#8B5CF6',
  compra: '#34D399',
};

function withAlpha(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

    // Touches por conversión, hasta 5 por journey
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
      WHERE pos <= 5
      ORDER BY cid, pos
    `)) as unknown as Array<{ cid: number; canal: string; pos: number }>;

    // Email-only conversions matcheadas por Perfit
    const perfitRows = (await db.execute(sql`
      SELECT DISTINCT ON (c.id)
        c.id AS cid,
        pe.campaign_name
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

    // Totales para el resumen
    const [summary] = (await db.execute(sql`
      SELECT
        COUNT(*)::int                            AS total,
        COALESCE(SUM(monto::numeric), 0)::float AS monto_total
      FROM conversions
      WHERE fecha::date BETWEEN ${desde}::date AND ${hasta}::date
    `)) as unknown as Array<{ total: number; monto_total: number }>;

    // Construir map cid -> canales[]
    const journeys = new Map<number, string[]>();

    for (const row of touchRows) {
      if (!journeys.has(row.cid)) journeys.set(row.cid, []);
      journeys.get(row.cid)!.push(row.canal);
    }
    for (const row of perfitRows) {
      if (!journeys.has(row.cid)) journeys.set(row.cid, ['email']);
    }

    // Contar links: "canal_pos|canal_pos" -> { count, canal }
    const linkCounts = new Map<string, { count: number; canal: string }>();
    for (const canales of journeys.values()) {
      for (let i = 0; i < canales.length; i++) {
        const src = `${canales[i]}_${i + 1}`;
        const tgt =
          i + 1 < canales.length ? `${canales[i + 1]}_${i + 2}` : 'compra';
        const key = `${src}|${tgt}`;
        const existing = linkCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          linkCounts.set(key, { count: 1, canal: canales[i] });
        }
      }
    }

    // Construir nodos únicos
    const nodeKeySet = new Set<string>();
    for (const key of linkCounts.keys()) {
      const [src, tgt] = key.split('|');
      nodeKeySet.add(src);
      nodeKeySet.add(tgt);
    }

    const sorted = [...nodeKeySet]
      .filter((k) => k !== 'compra')
      .sort((a, b) => {
        const pa = parseInt(a.split('_').pop() ?? '0');
        const pb = parseInt(b.split('_').pop() ?? '0');
        return pa !== pb ? pa - pb : a.localeCompare(b);
      });
    if (nodeKeySet.has('compra')) sorted.push('compra');

    const nodeIndex = new Map<string, number>();
    const nodes: Array<{ key: string; label: string; color: string }> = [];

    for (const key of sorted) {
      nodeIndex.set(key, nodes.length);
      const canal = key === 'compra' ? 'compra' : key.split('_')[0];
      const pos = key === 'compra' ? null : parseInt(key.split('_').pop() ?? '1');
      const label =
        key === 'compra'
          ? 'Compra'
          : `${CANAL_LABELS[canal] ?? canal}${pos !== null ? ` (T${pos})` : ''}`;
      nodes.push({ key, label, color: CANAL_COLORS[canal] ?? '#94A3B8' });
    }

    const links: Array<{
      source: number;
      target: number;
      value: number;
      color: string;
    }> = [];

    for (const [key, { count, canal }] of linkCounts) {
      const [src, tgt] = key.split('|');
      links.push({
        source: nodeIndex.get(src)!,
        target: nodeIndex.get(tgt)!,
        value: count,
        color: withAlpha(CANAL_COLORS[canal] ?? '#94A3B8', 0.4),
      });
    }

    res.json({
      nodes,
      links,
      summary: {
        total: summary?.total ?? 0,
        atribuidas: journeys.size,
        sin_atribucion: (summary?.total ?? 0) - journeys.size,
        monto_total: summary?.monto_total ?? 0,
      },
    });
  } catch (err) {
    console.error('[dashboard/sankey] Error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
