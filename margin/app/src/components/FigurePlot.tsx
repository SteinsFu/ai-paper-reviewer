/* ============================================================
   Margin — data-driven figure plots
   Renders a manuscript figure's PlotSpec as token-styled SVG:
   bars · line · scatter · box · heatmap. Theme-aware (all colors
   are CSS custom properties), deterministic, a legend for ≥2
   series, recessive axes/grid. Used by the reader (and Visual).
   ============================================================ */
import type {
  PlotSpec, BarsPlot, LinePlot, ScatterPlot, BoxPlot, HeatmapPlot,
} from "../services/types";

/* fixed categorical order — colour follows the series, never its rank */
const PALETTE = [
  "var(--accent-deep)", "var(--info)", "var(--teal)", "var(--violet)", "var(--pink)", "var(--ok)",
];

const W = 560, H = 300;
const M = { top: 16, right: 20, bottom: 44, left: 50 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;

const AXIS = "var(--line-strong)";
const GRID = "var(--line-2)";
const INK = "var(--text-3)";

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}
function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(v < 1 ? 2 : 1);
}

/* shared numeric y-axis with 4 gridlines + labels */
function YAxis({ max, min = 0 }: { max: number; min?: number }) {
  const ticks = 4;
  const rows = Array.from({ length: ticks + 1 }, (_, i) => min + ((max - min) * i) / ticks);
  return (
    <g>
      {rows.map((val, i) => {
        const y = M.top + IH - (IH * (val - min)) / (max - min || 1);
        return (
          <g key={i}>
            <line x1={M.left} x2={M.left + IW} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={M.left - 8} y={y + 3.5} textAnchor="end" fontSize={10.5} fill={INK}>{fmt(val)}</text>
          </g>
        );
      })}
    </g>
  );
}

function AxisTitles({ x, y }: { x?: string; y?: string }) {
  return (
    <>
      {x && <text x={M.left + IW / 2} y={H - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK}>{x}</text>}
      {y && (
        <text transform={`translate(13 ${M.top + IH / 2}) rotate(-90)`} textAnchor="middle"
          fontSize={11} fontWeight={600} fill={INK}>{y}</text>
      )}
    </>
  );
}

function Legend({ names }: { names: string[] }) {
  if (names.length < 2) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", justifyContent: "center", marginTop: 8 }}>
      {names.map((n, i) => (
        <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-2)" }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: PALETTE[i % PALETTE.length] }} />
          {n}
        </span>
      ))}
    </div>
  );
}

/* ---- bars ---------------------------------------------------------------- */
function Bars({ spec }: { spec: BarsPlot }) {
  const max = niceMax(Math.max(...spec.series.flatMap((s, si) =>
    s.values.map((v, ci) => v + (spec.errors?.[si]?.[ci] ?? 0)))));
  const n = spec.categories.length;
  const slot = IW / n;
  const ns = spec.series.length;
  const groupW = slot * 0.68;
  const barW = groupW / ns;
  const yOf = (v: number) => M.top + IH - (IH * v) / max;
  return (
    <>
      <YAxis max={max} />
      <line x1={M.left} x2={M.left + IW} y1={M.top + IH} y2={M.top + IH} stroke={AXIS} strokeWidth={1.5} />
      {spec.categories.map((cat, ci) => {
        const cx = M.left + slot * (ci + 0.5);
        return (
          <g key={ci}>
            {spec.series.map((s, si) => {
              const x = cx - groupW / 2 + si * barW;
              const v = s.values[ci];
              const y = yOf(v);
              const err = spec.errors?.[si]?.[ci];
              return (
                <g key={si}>
                  <rect x={x + 1} y={y} width={barW - 2} height={M.top + IH - y} rx={3}
                    fill={PALETTE[si % PALETTE.length]} />
                  {err != null && (
                    <g stroke="var(--text)" strokeWidth={1.3}>
                      <line x1={x + barW / 2} x2={x + barW / 2} y1={yOf(v + err)} y2={yOf(v - err)} />
                      <line x1={x + barW / 2 - 3} x2={x + barW / 2 + 3} y1={yOf(v + err)} y2={yOf(v + err)} />
                      <line x1={x + barW / 2 - 3} x2={x + barW / 2 + 3} y1={yOf(v - err)} y2={yOf(v - err)} />
                    </g>
                  )}
                </g>
              );
            })}
            <text x={cx} y={M.top + IH + 15} textAnchor="middle" fontSize={10.5} fill={INK}>{cat}</text>
          </g>
        );
      })}
      <AxisTitles x={spec.xLabel} y={spec.yLabel} />
    </>
  );
}

/* ---- line ---------------------------------------------------------------- */
function Line({ spec }: { spec: LinePlot }) {
  const max = niceMax(Math.max(...spec.series.flatMap((s) => s.values)));
  const xmin = Math.min(...spec.x), xmax = Math.max(...spec.x);
  const xOf = (v: number) => M.left + (IW * (v - xmin)) / (xmax - xmin || 1);
  const yOf = (v: number) => M.top + IH - (IH * v) / max;
  return (
    <>
      <YAxis max={max} />
      <line x1={M.left} x2={M.left + IW} y1={M.top + IH} y2={M.top + IH} stroke={AXIS} strokeWidth={1.5} />
      {spec.x.map((xv, i) => (
        <text key={i} x={xOf(xv)} y={M.top + IH + 15} textAnchor="middle" fontSize={10} fill={INK}>{fmt(xv)}</text>
      ))}
      {spec.series.map((s, si) => {
        const pts = s.values.map((v, i) => `${xOf(spec.x[i])},${yOf(v)}`).join(" ");
        const color = PALETTE[si % PALETTE.length];
        return (
          <g key={si}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={xOf(spec.x[i])} cy={yOf(v)} r={3} fill="var(--surface)" stroke={color} strokeWidth={2} />
            ))}
          </g>
        );
      })}
      <AxisTitles x={spec.xLabel} y={spec.yLabel} />
    </>
  );
}

/* ---- scatter ------------------------------------------------------------- */
function Scatter({ spec }: { spec: ScatterPlot }) {
  const all = spec.series.flatMap((s) => s.points);
  const xmax = niceMax(Math.max(...all.map((p) => p[0])));
  const ymax = niceMax(Math.max(...all.map((p) => p[1])));
  const xOf = (v: number) => M.left + (IW * v) / xmax;
  const yOf = (v: number) => M.top + IH - (IH * v) / ymax;
  // least-squares trend across all points
  let trend: [number, number, number, number] | null = null;
  if (spec.trend && all.length > 1) {
    const n = all.length;
    const sx = all.reduce((a, p) => a + p[0], 0), sy = all.reduce((a, p) => a + p[1], 0);
    const sxx = all.reduce((a, p) => a + p[0] * p[0], 0), sxy = all.reduce((a, p) => a + p[0] * p[1], 0);
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
    const intercept = (sy - slope * sx) / n;
    trend = [0, intercept, xmax, slope * xmax + intercept];
  }
  const xticks = Array.from({ length: 5 }, (_, i) => (xmax * i) / 4);
  return (
    <>
      <YAxis max={ymax} />
      <line x1={M.left} x2={M.left + IW} y1={M.top + IH} y2={M.top + IH} stroke={AXIS} strokeWidth={1.5} />
      {xticks.map((xv, i) => (
        <text key={i} x={xOf(xv)} y={M.top + IH + 15} textAnchor="middle" fontSize={10} fill={INK}>{fmt(xv)}</text>
      ))}
      {trend && (
        <line x1={xOf(trend[0])} y1={yOf(trend[1])} x2={xOf(trend[2])} y2={yOf(trend[3])}
          stroke="var(--text-3)" strokeWidth={1.5} strokeDasharray="5 4" />
      )}
      {spec.series.map((s, si) => (
        <g key={si} fill={PALETTE[si % PALETTE.length]} fillOpacity={0.8}>
          {s.points.map((p, i) => <circle key={i} cx={xOf(p[0])} cy={yOf(p[1])} r={4} />)}
        </g>
      ))}
      <AxisTitles x={spec.xLabel} y={spec.yLabel} />
    </>
  );
}

/* ---- box-and-whisker ----------------------------------------------------- */
function Box({ spec }: { spec: BoxPlot }) {
  const max = niceMax(Math.max(...spec.groups.map((g) => g.max)));
  const min = Math.min(0, ...spec.groups.map((g) => g.min));
  const yOf = (v: number) => M.top + IH - (IH * (v - min)) / (max - min || 1);
  const n = spec.groups.length;
  const slot = IW / n;
  const boxW = Math.min(46, slot * 0.5);
  return (
    <>
      <YAxis max={max} min={min} />
      <line x1={M.left} x2={M.left + IW} y1={M.top + IH} y2={M.top + IH} stroke={AXIS} strokeWidth={1.5} />
      {spec.groups.map((g, i) => {
        const cx = M.left + slot * (i + 0.5);
        const color = PALETTE[i % PALETTE.length];
        return (
          <g key={i}>
            {/* whiskers */}
            <line x1={cx} x2={cx} y1={yOf(g.max)} y2={yOf(g.q3)} stroke={color} strokeWidth={1.5} />
            <line x1={cx} x2={cx} y1={yOf(g.min)} y2={yOf(g.q1)} stroke={color} strokeWidth={1.5} />
            <line x1={cx - 8} x2={cx + 8} y1={yOf(g.max)} y2={yOf(g.max)} stroke={color} strokeWidth={1.5} />
            <line x1={cx - 8} x2={cx + 8} y1={yOf(g.min)} y2={yOf(g.min)} stroke={color} strokeWidth={1.5} />
            {/* box */}
            <rect x={cx - boxW / 2} y={yOf(g.q3)} width={boxW} height={yOf(g.q1) - yOf(g.q3)} rx={3}
              fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1.5} />
            <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yOf(g.median)} y2={yOf(g.median)} stroke={color} strokeWidth={2.2} />
            <text x={cx} y={M.top + IH + 15} textAnchor="middle" fontSize={10.5} fill={INK}>{g.name}</text>
          </g>
        );
      })}
      <AxisTitles x={spec.xLabel} y={spec.yLabel} />
    </>
  );
}

/* ---- heatmap / confusion matrix ------------------------------------------ */
function Heatmap({ spec }: { spec: HeatmapPlot }) {
  const left = 74, top = 8, right = 12, bottom = 34;
  const gw = W - left - right, gh = H - top - bottom;
  const cw = gw / spec.cols.length, ch = gh / spec.rows.length;
  return (
    <>
      {spec.values.map((row, r) =>
        row.map((val, c) => {
          const clamped = Math.max(0, Math.min(1, val));
          return (
            <g key={`${r}-${c}`}>
              <rect x={left + c * cw + 1} y={top + r * ch + 1} width={cw - 2} height={ch - 2} rx={3}
                fill="var(--accent-deep)" fillOpacity={0.12 + clamped * 0.82} />
              <text x={left + c * cw + cw / 2} y={top + r * ch + ch / 2 + 3.5} textAnchor="middle"
                fontSize={10.5} fontWeight={600} fill={clamped > 0.55 ? "#fff" : "var(--text)"}>{fmt(val)}</text>
            </g>
          );
        }),
      )}
      {spec.rows.map((rl, r) => (
        <text key={r} x={left - 8} y={top + r * ch + ch / 2 + 3.5} textAnchor="end" fontSize={10.5} fill={INK}>{rl}</text>
      ))}
      {spec.cols.map((cl, c) => (
        <text key={c} x={left + c * cw + cw / 2} y={H - 18} textAnchor="middle" fontSize={10.5} fill={INK}>{cl}</text>
      ))}
      {spec.xLabel && <text x={left + gw / 2} y={H - 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK}>{spec.xLabel}</text>}
    </>
  );
}

function legendNames(spec: PlotSpec): string[] {
  switch (spec.type) {
    case "bars": return spec.series.map((s) => s.name);
    case "line": return spec.series.map((s) => s.name);
    case "scatter": return spec.series.map((s) => s.name);
    default: return [];
  }
}

export function FigurePlot({ spec }: { spec: PlotSpec }) {
  return (
    <div style={{ background: "var(--grad-card)", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px 12px" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} role="img" aria-label={`${spec.type} chart`}>
        {spec.type === "bars" && <Bars spec={spec} />}
        {spec.type === "line" && <Line spec={spec} />}
        {spec.type === "scatter" && <Scatter spec={spec} />}
        {spec.type === "box" && <Box spec={spec} />}
        {spec.type === "heatmap" && <Heatmap spec={spec} />}
      </svg>
      <Legend names={legendNames(spec)} />
    </div>
  );
}
