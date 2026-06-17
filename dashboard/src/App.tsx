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
  fromPos: number; fromCanal: string;
  toPos: number;   toCanal: string;
  count: number;
}
interface Summary {
  total: number; atribuidas: number; sin_atribucion: number; monto_total: number;
}
interface SankeyData {
  columns: SankeyColumn[]; flows: Flow[]; summary: Summary;
}

// ─── Channel config ───────────────────────────────────────────────────────────

const CH: Record<string, { color: string; light: string; icon: JSX.Element }> = {
  meta:     { color: '#1877F2', light: '#DBEAFE', icon: <IconMeta /> },
  google:   { color: '#EA4335', light: '#FEE2E2', icon: <IconGoogle /> },
  email:    { color: '#D97706', light: '#FEF3C7', icon: <IconEmail /> },
  tiktok:   { color: '#1a1a1a', light: '#F1F5F9', icon: <IconTikTok /> },
  organico: { color: '#059669', light: '#D1FAE5', icon: <IconOrganico /> },
  directo:  { color: '#6366F1', light: '#EDE9FE', icon: <IconDirecto /> },
  referral: { color: '#7C3AED', light: '#EDE9FE', icon: <IconReferral /> },
  compra:   { color: '#0D9488', light: '#CCFBF1', icon: <IconCompra /> },
};

function chConf(canal: string) {
  return CH[canal] ?? { color: '#94A3B8', light: '#F1F5F9', icon: <span>·</span> };
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function Ico({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-label={title}>
      {children}
    </svg>
  );
}
function IconMeta() {
  return <Ico title="Meta"><path d="M8 1C4.13 1 1 4.13 1 8s3.13 7 7 7 7-3.13 7-7S11.87 1 8 1zM5.5 6c.69 0 1.3.28 1.74.73L8 7.54l.76-.81A2.38 2.38 0 0 1 10.5 6c1.38 0 2.5 1 2.5 2.5 0 .75-.3 1.42-.78 1.9L8 14 3.78 10.4A2.7 2.7 0 0 1 3 8.5C3 7 4.12 6 5.5 6z"/></Ico>;
}
function IconGoogle() {
  return <Ico title="Google"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.5 7.5H8.5V11h-1V8.5H5v-1h2.5V5h1v2.5H11.5v1z"/></Ico>;
}
function IconEmail() {
  return <Ico title="Email"><path d="M2 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v.5L8 9 2 4.5V4zm0 1.83V12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5.83L8 10.5 2 5.83z"/></Ico>;
}
function IconTikTok() {
  return <Ico title="TikTok"><path d="M11 2v2a3 3 0 0 0 3 3v2a5 5 0 0 1-3-1v4a4 4 0 1 1-4-4h1V10a2 2 0 1 0 2 2V2h1z"/></Ico>;
}
function IconOrganico() {
  return <Ico title="Orgánico"><path d="M8 1C5 1 2 4 2 8c0 2.5 1.5 4.5 3.5 5.5A5 5 0 0 1 7 9c0-2 1-3.5 2.5-4.5C10 4 10 2 8 1zM9 5c0 1.5-.5 3-2 4.5C8 11 10 12 11 14c2-1.5 3-4 3-6C14 4.5 11.5 3 9 5z"/></Ico>;
}
function IconDirecto() {
  return <Ico title="Directo"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.5 7.5h-5l2-2-.7-.7L4.8 8.8 7.8 11.8l.7-.7-2-2h5v-1z"/></Ico>;
}
function IconReferral() {
  return <Ico title="Referral"><path d="M11 1l4 4-4 4V7H7a3 3 0 0 0-3 3v2H2v-2a5 5 0 0 1 5-5h4V1z"/></Ico>;
}
function IconCompra() {
  return <Ico title="Compra"><path d="M1 2h2l2.4 7h6.2L14 4H5.1L4.2 2H1zm4 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></Ico>;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const COL_W   = 164;
const COL_GAP = 80;
const NODE_H  = 54;
const NODE_GAP = 10;
const PT = 54;
const PB = 68;
const PS = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;

function toDateInput(d: Date) { return d.toISOString().slice(0, 10); }

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString('es-AR')}`;
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

function ribbonPath(
  sx: number, sy: number,
  tx: number, ty: number,
  hw: number
): string {
  const cpd = (tx - sx) * 0.5;
  return [
    `M ${sx},${sy - hw}`,
    `C ${sx + cpd},${sy - hw} ${tx - cpd},${ty - hw} ${tx},${ty - hw}`,
    `L ${tx},${ty + hw}`,
    `C ${tx - cpd},${ty + hw} ${sx + cpd},${sy + hw} ${sx},${sy + hw}`,
    'Z',
  ].join(' ');
}

// ─── Node Card ────────────────────────────────────────────────────────────────

function NodeCard({ ch }: { ch: ChannelNode }) {
  const cfg = chConf(ch.canal);

  if (ch.isCompra) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: NODE_H, padding: '0 12px',
        background: `linear-gradient(135deg, ${cfg.light} 0%, #fff 100%)`,
        border: `2px solid ${cfg.color}`,
        borderRadius: 12,
        boxShadow: `0 2px 8px ${cfg.color}30`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: cfg.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}>
          {cfg.icon}
        </div>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
          {ch.label}
        </span>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
            {ch.count.toLocaleString()}
          </div>
          {ch.pct !== undefined && (
            <div style={{
              fontSize: 11, fontWeight: 700, color: cfg.color,
              background: cfg.light, borderRadius: 4, padding: '1px 5px',
              display: 'inline-block', marginTop: 2,
            }}>
              {ch.pct}%
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: NODE_H, padding: '0 12px 0 8px',
      background: '#fff',
      border: '1.5px solid #E2E8F0',
      borderLeft: `3.5px solid ${cfg.color}`,
      borderRadius: 12,
      boxShadow: '0 1px 3px #00000008',
      position: 'relative',
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
        background: cfg.light,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: cfg.color,
      }}>
        {cfg.icon}
      </div>
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#374151' }}>
        {ch.label}
      </span>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', flexShrink: 0 }}>
        {ch.count.toLocaleString()}
      </div>
    </div>
  );
}

// ─── Sankey Chart ─────────────────────────────────────────────────────────────

function SankeyChart({ columns, flows }: { columns: SankeyColumn[]; flows: Flow[] }) {
  const positions = useMemo(() => buildPositions(columns), [columns]);
  const maxNodes  = useMemo(() => Math.max(...columns.map(c => c.channels.length), 1), [columns]);
  const maxFlow   = useMemo(() => Math.max(...flows.map(f => f.count), 1), [flows]);

  const totalW = PS * 2 + columns.length * COL_W + (columns.length - 1) * COL_GAP;
  const totalH = PT + PB + maxNodes * (NODE_H + NODE_GAP);

  function renderRibbon(f: Flow) {
    const s = positions.get(`${f.fromPos}|${f.fromCanal}`);
    const t = positions.get(`${f.toPos}|${f.toCanal}`);
    if (!s || !t) return null;

    const sx = s.x + COL_W;
    const sy = s.y + NODE_H / 2;
    const tx = t.x;
    const ty = t.y + NODE_H / 2;
    const hw = Math.max(4, (f.count / maxFlow) * 18);
    const cfg = chConf(f.fromCanal);
    const toCompra = f.toCanal === 'compra';

    return (
      <path
        key={`${f.fromPos}|${f.fromCanal}>${f.toPos}|${f.toCanal}`}
        d={ribbonPath(sx, sy, tx, ty, hw)}
        fill={cfg.color}
        fillOpacity={toCompra ? 0.5 : 0.2}
      />
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        position: 'relative', width: totalW, height: totalH, minWidth: totalW,
        /* subtle dot grid */
        backgroundImage: 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
        backgroundSize: '22px 22px',
        borderRadius: 12,
      }}>

        {/* Ribbons (below nodes) */}
        <svg style={{
          position: 'absolute', top: 0, left: 0,
          width: totalW, height: totalH, pointerEvents: 'none',
          overflow: 'visible',
        }}>
          {/* Render non-compra flows first (below), compra flows on top */}
          {flows.filter(f => f.toCanal !== 'compra').map(f => renderRibbon(f))}
          {flows.filter(f => f.toCanal === 'compra').map(f => renderRibbon(f))}
        </svg>

        {/* Column headers */}
        {columns.map((col) => {
          const x = PS + (col.position - 1) * (COL_W + COL_GAP);
          return (
            <div key={`hdr-${col.position}`}>
              <div style={{
                position: 'absolute', top: 12, left: x, width: COL_W,
                textAlign: 'center',
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#64748B',
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  background: '#fff', padding: '2px 10px', borderRadius: 20,
                  border: '1px solid #E2E8F0',
                }}>
                  {col.label}
                </span>
              </div>

              {/* Revenue footer */}
              {col.total_revenue > 0 && (
                <div style={{
                  position: 'absolute', bottom: 10, left: x, width: COL_W,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    INGRESOS
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', marginTop: 1 }}>
                    {fmtMoney(col.total_revenue)}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Vertical separator lines between columns */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: totalW, height: totalH, pointerEvents: 'none' }}>
          {columns.slice(0, -1).map((col) => {
            const x = PS + (col.position - 1) * (COL_W + COL_GAP) + COL_W + COL_GAP / 2;
            return (
              <line key={`sep-${col.position}`}
                x1={x} y1={PT - 8} x2={x} y2={totalH - PB + 8}
                stroke="#E2E8F0" strokeWidth={1} strokeDasharray="4 4"
              />
            );
          })}
        </svg>

        {/* Nodes (on top) */}
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

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, accent, icon,
}: {
  label: string; value: string; sub?: string; accent: string; icon: string;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '18px 22px',
      boxShadow: '0 1px 4px #0000000e, 0 4px 16px #0000000a',
      display: 'flex', alignItems: 'flex-start', gap: 14, flex: '1 1 180px',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: `${accent}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
          {label}
        </p>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '4px 0 2px', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {value}
        </p>
        {sub && <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{sub}</p>}
      </div>
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
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #F1F5F9',
        padding: '14px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        boxShadow: '0 1px 3px #00000008',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>
            📊
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1 }}>
              Multi-Touch Attribution
            </h1>
            <p style={{ fontSize: 11.5, color: '#94A3B8', margin: '2px 0 0' }}>Altorancho · Journey Analytics</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, overflow: 'hidden',
          }}>
            <input type="date" value={desde} max={hasta}
              onChange={e => setDesde(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#374151', padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
            />
            <span style={{ color: '#CBD5E1', padding: '0 4px', fontSize: 12 }}>→</span>
            <input type="date" value={hasta} min={desde} max={toDateInput(new Date())}
              onChange={e => setHasta(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#374151', padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
            />
          </div>
          <button
            onClick={() => fetchData(desde, hasta)}
            disabled={loading}
            style={{
              background: loading ? '#F1F5F9' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              color: loading ? '#94A3B8' : '#fff',
              border: 'none', borderRadius: 9, padding: '8px 18px',
              fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 2px 8px #6366F140',
            }}
          >
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>
      </header>

      <main style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Summary cards */}
        {data && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <SummaryCard
              icon="🛍️" label="Conversiones" accent="#6366F1"
              value={data.summary.total.toLocaleString()}
              sub="en el período"
            />
            <SummaryCard
              icon="🎯" label="Con atribución" accent="#10B981"
              value={`${data.summary.atribuidas.toLocaleString()} (${pct}%)`}
              sub={`${data.summary.sin_atribucion} sin match de visitor`}
            />
            <SummaryCard
              icon="💰" label="Revenue total" accent="#F59E0B"
              value={fmtMoney(data.summary.monto_total)}
              sub="órdenes pagadas"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
            padding: '10px 14px', color: '#B91C1C', fontSize: 13,
          }}>
            ⚠️ Error al cargar: {error}
          </div>
        )}

        {/* Chart */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: '24px',
          boxShadow: '0 1px 4px #0000000e, 0 4px 16px #00000008',
          border: '1px solid #F1F5F9',
        }}>
          {loading && !data && (
            <div style={emptyStyle}><Spinner />Cargando datos…</div>
          )}
          {!loading && !hasData && (
            <div style={emptyStyle}>
              <span style={{ fontSize: 40 }}>📈</span>
              <strong style={{ color: '#374151', fontSize: 15 }}>
                No hay conversiones atribuidas en este período
              </strong>
              <span style={{ fontSize: 13, color: '#9CA3AF', maxWidth: 380, textAlign: 'center' }}>
                Los datos aparecen cuando el tracking script captura toques
                y Tienda Nube envía el webhook de compra.
              </span>
            </div>
          )}
          {hasData && (
            <SankeyChart columns={data!.columns} flows={data!.flows} />
          )}
        </div>

        {/* Legend */}
        {hasData && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', justifyContent: 'center', padding: '4px 0' }}>
            {Object.entries(CH).map(([canal, cfg]) => (
              <span key={canal} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748B' }}>
                <span style={{
                  width: 10, height: 10, borderRadius: 3,
                  background: cfg.color, flexShrink: 0, display: 'inline-block',
                }} />
                {canal === 'compra' ? 'Compra' : canal.charAt(0).toUpperCase() + canal.slice(1)}
              </span>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="10" cy="10" r="8" fill="none" stroke="#E2E8F0" strokeWidth="2.5" />
      <path d="M10 2a8 8 0 0 1 8 8" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const emptyStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', minHeight: 300, textAlign: 'center',
  gap: 10, color: '#9CA3AF',
};
