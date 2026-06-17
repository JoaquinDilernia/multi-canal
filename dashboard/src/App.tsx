import { useEffect, useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChannelNode {
  canal: string;
  label: string;
  count: number;
  revenue: number;
  isCompra: boolean;
  pct?: number;
}

interface SankeyColumn {
  position: number;
  label: string;
  channels: ChannelNode[];
  total_revenue: number;
}

interface Flow {
  fromPos: number;
  fromCanal: string;
  toPos: number;
  toCanal: string;
  count: number;
}

interface Summary {
  total: number;
  atribuidas: number;
  sin_atribucion: number;
  monto_total: number;
}

interface SankeyData {
  columns: SankeyColumn[];
  flows: Flow[];
  summary: Summary;
}

// ─── Channel config ───────────────────────────────────────────────────────────

const CH: Record<string, { color: string; bg: string; icon: string }> = {
  meta:     { color: '#1877F2', bg: '#EFF6FF', icon: 'M' },
  google:   { color: '#EA4335', bg: '#FEF2F2', icon: 'G' },
  email:    { color: '#D97706', bg: '#FFFBEB', icon: '✉' },
  tiktok:   { color: '#1a1a1a', bg: '#F8FAFC', icon: '♪' },
  organico: { color: '#059669', bg: '#ECFDF5', icon: '⬡' },
  directo:  { color: '#6B7280', bg: '#F9FAFB', icon: '⊙' },
  referral: { color: '#7C3AED', bg: '#F5F3FF', icon: '↗' },
  compra:   { color: '#0D9488', bg: '#F0FDFA', icon: '✓' },
};

function chConf(canal: string) {
  return CH[canal] ?? { color: '#94A3B8', bg: '#F8FAFC', icon: '·' };
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const COL_W   = 158;
const COL_GAP = 74;
const NODE_H  = 44;
const NODE_GAP = 8;
const PT = 48;   // padding top
const PB = 58;   // padding bottom
const PS = 8;    // padding sides

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;

function toDateInput(d: Date) { return d.toISOString().slice(0, 10); }

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString('es-AR')}`;
}

interface NodePos { x: number; y: number }

function buildPositions(columns: SankeyColumn[]) {
  const map = new Map<string, NodePos>();
  for (const col of columns) {
    const x = PS + (col.position - 1) * (COL_W + COL_GAP);
    let y = PT;
    for (const ch of col.channels) {
      map.set(`${col.position}|${ch.canal}`, { x, y });
      y += NODE_H + NODE_GAP;
    }
  }
  return map;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NodeCard({ ch }: { ch: ChannelNode }) {
  const cfg = chConf(ch.canal);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      height: NODE_H, padding: '0 10px',
      background: ch.isCompra ? cfg.bg : '#FFFFFF',
      border: `1.5px solid ${ch.isCompra ? cfg.color : '#E2E8F0'}`,
      borderRadius: 10,
      boxShadow: ch.isCompra ? `0 0 0 1px ${cfg.color}22` : '0 1px 2px #0000000a',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Color strip */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: cfg.color, borderRadius: '10px 0 0 10px',
      }} />
      {/* Icon badge */}
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        background: cfg.color, display: 'flex', alignItems: 'center',
        justifyContent: 'center', marginLeft: 4,
        fontSize: 11, fontWeight: 700, color: '#fff',
      }}>
        {cfg.icon}
      </div>
      {/* Label */}
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#1E293B', lineHeight: 1.2 }}>
        {ch.label}
      </span>
      {/* Count + pct */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
          {ch.count.toLocaleString()}
        </div>
        {ch.isCompra && ch.pct !== undefined && (
          <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color, marginTop: -1 }}>
            {ch.pct}%
          </div>
        )}
      </div>
    </div>
  );
}

function SankeyChart({ columns, flows }: { columns: SankeyColumn[]; flows: Flow[] }) {
  const positions = useMemo(() => buildPositions(columns), [columns]);

  const maxNodes = useMemo(
    () => Math.max(...columns.map(c => c.channels.length), 1),
    [columns]
  );
  const totalW = PS * 2 + columns.length * COL_W + (columns.length - 1) * COL_GAP;
  const totalH = PT + PB + maxNodes * (NODE_H + NODE_GAP);

  const maxFlow = useMemo(() => Math.max(...flows.map(f => f.count), 1), [flows]);

  function flowPath(f: Flow) {
    const srcKey = `${f.fromPos}|${f.fromCanal}`;
    const tgtKey = `${f.toPos}|${f.toCanal}`;
    const s = positions.get(srcKey);
    const t = positions.get(tgtKey);
    if (!s || !t) return null;

    const sx = s.x + COL_W;
    const sy = s.y + NODE_H / 2;
    const tx = t.x;
    const ty = t.y + NODE_H / 2;
    const dx = tx - sx;
    const strokeW = Math.max(1.5, (f.count / maxFlow) * 18);
    const cfg = chConf(f.fromCanal);

    return (
      <path
        key={`${srcKey}>${tgtKey}`}
        d={`M ${sx},${sy} C ${sx + dx * 0.45},${sy} ${tx - dx * 0.45},${ty} ${tx},${ty}`}
        fill="none"
        stroke={f.toCanal === 'compra' ? cfg.color : cfg.color}
        strokeOpacity={f.toCanal === 'compra' ? 0.55 : 0.3}
        strokeWidth={strokeW}
      />
    );
  }

  return (
    <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
      <div style={{ position: 'relative', width: totalW, height: totalH, minWidth: totalW }}>

        {/* SVG connections */}
        <svg
          style={{ position: 'absolute', top: 0, left: 0, width: totalW, height: totalH, pointerEvents: 'none' }}
        >
          {flows.map(f => flowPath(f))}
        </svg>

        {/* Column headers + revenue */}
        {columns.map((col) => {
          const x = PS + (col.position - 1) * (COL_W + COL_GAP);
          return (
            <div key={`hdr-${col.position}`}>
              {/* Header */}
              <div style={{
                position: 'absolute', top: 10, left: x, width: COL_W,
                textAlign: 'center', fontSize: 10.5, fontWeight: 700,
                color: '#94A3B8', letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                {col.label}
              </div>
              {/* Revenue footer */}
              {col.total_revenue > 0 && (
                <div style={{
                  position: 'absolute', bottom: 10, left: x, width: COL_W,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    INGRESOS
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginTop: 1 }}>
                    {fmtMoney(col.total_revenue)}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Nodes */}
        {columns.map((col) =>
          col.channels.map((ch) => {
            const pos = positions.get(`${col.position}|${ch.canal}`);
            if (!pos) return null;
            return (
              <div
                key={`${col.position}|${ch.canal}`}
                style={{ position: 'absolute', top: pos.y, left: pos.x, width: COL_W }}
              >
                <NodeCard ch={ch} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '16px 20px',
      borderTop: `3px solid ${accent}`, boxShadow: '0 1px 4px #0000000d',
      minWidth: 180,
    }}>
      <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </p>
      <p style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: '5px 0 2px', letterSpacing: '-0.02em' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11.5, color: '#94A3B8' }}>{sub}</p>}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [desde, setDesde] = useState(toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [hasta, setHasta] = useState(toDateInput(new Date()));
  const [data, setData] = useState<SankeyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData(d: string, h: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/sankey?desde=${d}&hasta=${h}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(desde, hasta); }, []);

  const pct = data && data.summary.total > 0
    ? Math.round((data.summary.atribuidas / data.summary.total) * 100)
    : 0;

  const hasData = data && data.columns.length > 0;

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #E2E8F0',
        padding: '16px 28px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Atribución Multi-Touch
          </h1>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Altorancho</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input type="date" value={desde} max={hasta}
            onChange={e => setDesde(e.target.value)}
            style={inputStyle} />
          <span style={{ color: '#CBD5E1', fontSize: 13 }}>→</span>
          <input type="date" value={hasta} min={desde} max={toDateInput(new Date())}
            onChange={e => setHasta(e.target.value)}
            style={inputStyle} />
          <button
            onClick={() => fetchData(desde, hasta)}
            disabled={loading}
            style={{
              background: loading ? '#E2E8F0' : '#6366F1',
              color: loading ? '#94A3B8' : '#fff',
              border: 'none', borderRadius: 8, padding: '8px 16px',
              fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Summary cards */}
        {data && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <SummaryCard
              label="Conversiones"
              value={data.summary.total.toLocaleString()}
              sub="en el período"
              accent="#6366F1"
            />
            <SummaryCard
              label="Con atribución"
              value={`${data.summary.atribuidas.toLocaleString()} (${pct}%)`}
              sub={`${data.summary.sin_atribucion} sin match`}
              accent="#10B981"
            />
            <SummaryCard
              label="Revenue total"
              value={fmtMoney(data.summary.monto_total)}
              sub="órdenes pagadas"
              accent="#F59E0B"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
            padding: '10px 14px', color: '#DC2626', fontSize: 13,
          }}>
            Error: {error}
          </div>
        )}

        {/* Chart */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: '20px 24px',
          boxShadow: '0 1px 4px #0000000d', border: '1px solid #E2E8F0',
        }}>
          {loading && !data && (
            <div style={emptyStyle}>Cargando datos…</div>
          )}
          {!loading && !hasData && (
            <div style={emptyStyle}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
              <div style={{ fontWeight: 600, color: '#374151' }}>
                No hay conversiones atribuidas en este período
              </div>
              <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>
                Los datos aparecen cuando el script captura toques y TN envía el webhook de compra.
              </div>
            </div>
          )}
          {hasData && (
            <SankeyChart columns={data!.columns} flows={data!.flows} />
          )}
        </div>

        {/* Legend */}
        {hasData && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', justifyContent: 'center' }}>
            {Object.entries(CH).map(([canal, cfg]) => (
              <span key={canal} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#64748B' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0, display: 'inline-block' }} />
                {canal === 'compra' ? 'Compra' : (canal.charAt(0).toUpperCase() + canal.slice(1))}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A',
  borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit',
};

const emptyStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', minHeight: 280, textAlign: 'center', gap: 6,
  color: '#9CA3AF',
};
