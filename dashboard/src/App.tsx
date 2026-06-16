import { useEffect, useRef, useState } from 'react';
// @ts-ignore
import Plotly from 'plotly.js-dist-min';

interface SankeyNode {
  key: string;
  label: string;
  color: string;
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
  color: string;
}

interface Summary {
  total: number;
  atribuidas: number;
  sin_atribucion: number;
  monto_total: number;
}

interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  summary: Summary;
}

const API_BASE =
  import.meta.env.DEV
    ? 'http://localhost:3000'
    : window.location.origin;

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getDefaultDates() {
  const hasta = new Date();
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return { desde: toDateInput(desde), hasta: toDateInput(hasta) };
}

export default function App() {
  const defaults = getDefaultDates();
  const [desde, setDesde] = useState(defaults.desde);
  const [hasta, setHasta] = useState(defaults.hasta);
  const [data, setData] = useState<SankeyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  async function fetchData(d: string, h: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/dashboard/sankey?desde=${d}&hasta=${h}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: SankeyData = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(desde, hasta);
  }, []);

  useEffect(() => {
    if (!data || !chartRef.current) return;
    if (data.nodes.length === 0) return;

    const trace = {
      type: 'sankey',
      arrangement: 'snap',
      node: {
        pad: 24,
        thickness: 18,
        line: { color: '#0F172A', width: 0.5 },
        label: data.nodes.map((n) => n.label),
        color: data.nodes.map((n) => n.color),
        hovertemplate: '<b>%{label}</b><br>%{value} conversiones<extra></extra>',
      },
      link: {
        source: data.links.map((l) => l.source),
        target: data.links.map((l) => l.target),
        value: data.links.map((l) => l.value),
        color: data.links.map((l) => l.color),
        hovertemplate:
          '%{source.label} → %{target.label}<br><b>%{value}</b> conversiones<extra></extra>',
      },
    };

    const layout = {
      paper_bgcolor: '#1E293B',
      plot_bgcolor: '#1E293B',
      font: {
        family: "'Inter', system-ui, sans-serif",
        color: '#CBD5E1',
        size: 13,
      },
      margin: { t: 10, l: 10, r: 10, b: 10 },
    };

    Plotly.react(chartRef.current, [trace], layout, {
      responsive: true,
      displayModeBar: false,
    });
  }, [data]);

  const pct =
    data && data.summary.total > 0
      ? Math.round((data.summary.atribuidas / data.summary.total) * 100)
      : 0;

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.h1}>Atribución Multi-Touch</h1>
          <p style={styles.subtitle}>Altorancho · Customer Journey Analytics</p>
        </div>
        <div style={styles.controls}>
          <input
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => setDesde(e.target.value)}
          />
          <span style={{ color: '#64748B' }}>→</span>
          <input
            type="date"
            value={hasta}
            min={desde}
            max={toDateInput(new Date())}
            onChange={(e) => setHasta(e.target.value)}
          />
          <button
            style={loading ? styles.btnDisabled : styles.btn}
            onClick={() => fetchData(desde, hasta)}
            disabled={loading}
          >
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>
      </header>

      {/* Cards */}
      {data && (
        <div style={styles.cards}>
          <Card
            label="Conversiones totales"
            value={fmt(data.summary.total)}
            sub="en el período"
            accent="#6366F1"
          />
          <Card
            label="Con atribución"
            value={`${fmt(data.summary.atribuidas)} (${pct}%)`}
            sub={`${fmt(data.summary.sin_atribucion)} sin match`}
            accent="#10B981"
          />
          <Card
            label="Revenue total"
            value={fmtMoney(data.summary.monto_total)}
            sub="órdenes pagadas"
            accent="#F59E0B"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={styles.error}>
          Error al cargar datos: {error}
        </div>
      )}

      {/* Chart */}
      <div style={styles.chartWrap}>
        {loading && !data && (
          <div style={styles.placeholder}>Cargando datos…</div>
        )}
        {data && data.nodes.length === 0 && !loading && (
          <div style={styles.placeholder}>
            No hay conversiones con atribución en este período.
            <br />
            <span style={{ color: '#64748B', fontSize: 14 }}>
              Los datos aparecen cuando el script de tracking captura toques
              y TN envía el webhook de compra.
            </span>
          </div>
        )}
        <div
          ref={chartRef}
          style={{
            width: '100%',
            minHeight: 520,
            display: data && data.nodes.length > 0 ? 'block' : 'none',
          }}
        />
      </div>

      {/* Legend */}
      {data && data.nodes.length > 0 && (
        <footer style={styles.legend}>
          {Object.entries(CANAL_META).map(([canal, { label, color }]) => (
            <span key={canal} style={styles.legendItem}>
              <span
                style={{
                  ...styles.legendDot,
                  background: color,
                }}
              />
              {label}
            </span>
          ))}
        </footer>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div style={{ ...styles.card, borderTopColor: accent }}>
      <p style={styles.cardLabel}>{label}</p>
      <p style={styles.cardValue}>{value}</p>
      <p style={styles.cardSub}>{sub}</p>
    </div>
  );
}

const CANAL_META: Record<string, { label: string; color: string }> = {
  meta: { label: 'Meta', color: '#1877F2' },
  google: { label: 'Google', color: '#EA4335' },
  email: { label: 'Email', color: '#F59E0B' },
  tiktok: { label: 'TikTok', color: '#FF0050' },
  organico: { label: 'Orgánico', color: '#10B981' },
  directo: { label: 'Directo', color: '#94A3B8' },
  referral: { label: 'Referral', color: '#8B5CF6' },
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#0F172A',
    padding: '0 0 48px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    padding: '24px 32px',
    borderBottom: '1px solid #1E293B',
    background: 'linear-gradient(135deg, #0F172A 0%, #1a1f35 100%)',
  },
  h1: {
    fontSize: 22,
    fontWeight: 700,
    color: '#F8FAFC',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  btn: {
    background: '#6366F1',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 14,
    fontWeight: 500,
    transition: 'background 0.15s',
  },
  btnDisabled: {
    background: '#334155',
    color: '#64748B',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'not-allowed',
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    padding: '24px 32px 8px',
  },
  card: {
    background: '#1E293B',
    borderRadius: 12,
    padding: '20px 24px',
    borderTop: '3px solid #6366F1',
  },
  cardLabel: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 500,
  },
  cardValue: {
    fontSize: 26,
    fontWeight: 700,
    color: '#F8FAFC',
    margin: '6px 0 4px',
    letterSpacing: '-0.02em',
  },
  cardSub: {
    fontSize: 12,
    color: '#475569',
  },
  error: {
    margin: '16px 32px',
    padding: '12px 16px',
    background: '#450a0a',
    border: '1px solid #7f1d1d',
    borderRadius: 8,
    color: '#fca5a5',
    fontSize: 14,
  },
  chartWrap: {
    margin: '16px 32px',
    background: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 120,
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    color: '#475569',
    fontSize: 16,
    textAlign: 'center',
    gap: 12,
    padding: 32,
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px 20px',
    padding: '12px 32px',
    justifyContent: 'center',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#64748B',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
};
