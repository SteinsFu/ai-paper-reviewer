/* ============================================================
   Margin — shared components & icons
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;

/* ---- Icons (simple stroke set, SF-symbol-ish) -------------------------- */
const ICONS = {
  home:      "M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5",
  doc:       "M6 2.5h8l4 4V21a.5.5 0 0 1-.5.5H6A1.5 1.5 0 0 1 4.5 20V4A1.5 1.5 0 0 1 6 2.5ZM14 2.5V7h4",
  spark:     "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
  eye:       "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z",
  compass:   "M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19ZM15.5 8.5l-2 5-5 2 2-5 5-2Z",
  report:    "M5 3.5h11l3 3V20.5H5zM8.5 11.5h7M8.5 15h5M8.5 8h4",
  upload:    "M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 16v3.5h14V16",
  check:     "M4 12.5l5 5 11-11",
  checkCircle:"M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19ZM8 12l2.8 2.8L16 9.5",
  alert:     "M12 8v5m0 3h.01M10.3 3.9 2.4 18a1.8 1.8 0 0 0 1.6 2.7h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z",
  info:      "M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19ZM12 11v5m0-8h.01",
  search:    "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l5 5",
  chevR:     "M9 5l7 7-7 7",
  chevL:     "M15 5l-7 7 7 7",
  chevD:     "M5 9l7 7 7-7",
  close:     "M5 5l14 14M19 5 5 19",
  book:      "M12 6.5C10.5 5 8 4.5 4.5 4.5V19c3.5 0 6 .5 7.5 2 1.5-1.5 4-2 7.5-2V4.5C16 4.5 13.5 5 12 6.5ZM12 6.5V21",
  quote:     "M9.5 6C6.5 7 5 9.5 5 13v5h5v-5H7.5c0-2 .8-3.4 2.8-4L9.5 6ZM18.5 6c-3 1-4.5 3.5-4.5 7v5h5v-5h-2.5c0-2 .8-3.4 2.8-4L18.5 6Z",
  pen:       "M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z M14.5 6.5l3 3",
  layers:    "M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 16.5l9 5 9-5",
  clock:     "M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19ZM12 7v5l3.5 2",
  grid:      "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  link:      "M9.5 14.5l5-5M8 12l-2 2a3.5 3.5 0 0 0 5 5l2-2M16 12l2-2a3.5 3.5 0 0 0-5-5l-2 2",
  sliders:   "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6",
  arrowR:    "M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5",
  plus:      "M12 5v14M5 12h14",
  download:  "M12 4v11m0 0 4-4m-4 4-4-4M5 19h14",
  filter:    "M3 5h18l-7 8v6l-4-2v-4L3 5Z",
  bolt:      "M13 3 5 13h6l-1 8 8-10h-6l1-8Z",
  star:      "M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 17.1 6.7 20l1.2-6L3.4 9.8l6-.7L12 3.5Z",
};

function Icon({ name, size = 18, fill = false, style, className, strokeWidth = 1.7 }) {
  const d = ICONS[name] || "";
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}
      style={style} fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/* ---- Score ring -------------------------------------------------------- */
function ScoreRing({ value, size = 64, stroke = 6, color = "var(--accent-deep)", label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // arc fills via CSS transition (degrades to final value if not animated);
  // number is shown directly so it's always correct even in a frozen frame.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, [value]);
  const off = mounted ? c - (value / 100) * c : c;
  return (
    <div style={{ position:"relative", width:size, height:size, flex:"0 0 auto" }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition:"stroke-dashoffset 1s cubic-bezier(.22,.61,.36,1)" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", lineHeight:1 }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:size*0.30, fontWeight:700, letterSpacing:"-0.03em" }}>{value}</div>
          {sub && <div style={{ fontSize:9, color:"var(--text-3)", fontWeight:600, marginTop:1 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/* ---- Mini score bar ---------------------------------------------------- */
function ScoreBar({ value, color }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 60); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ height:7, borderRadius:99, background:"rgba(0,0,0,0.06)", overflow:"hidden", flex:1 }}>
      <div style={{ height:"100%", width:`${w}%`, borderRadius:99, background:color,
        transition:"width 1s cubic-bezier(.22,.61,.36,1)" }}/>
    </div>
  );
}

/* ---- Severity / category dot + tag ------------------------------------- */
function CatTag({ cat, small }) {
  const C = window.DATA.CATEGORIES[cat];
  if (!C) return null;
  return (
    <span className="chip" style={{ background:C.soft, color:C.color,
      height: small?22:26, fontSize: small?11.5:12.5, paddingInline: small?9:11 }}>
      <span className="dot" style={{ background:C.color, width:7, height:7 }} />
      {C.label}
    </span>
  );
}

function SevPill({ sev }) {
  const S = window.DATA.SEVERITY[sev];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11.5, fontWeight:700,
      color:S.color, background:S.soft, padding:"2px 9px", borderRadius:99 }}>
      <span className="dot" style={{ background:S.color, width:6, height:6 }}/>
      {S.label}
    </span>
  );
}

/* ---- Segmented control ------------------------------------------------- */
function Segmented({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---- Striped image placeholder ---------------------------------------- */
function Placeholder({ label, height = 160, style }) {
  return <div className="placeholder" style={{ height, ...style }}>{label}</div>;
}

Object.assign(window, {
  Icon, ICONS, ScoreRing, ScoreBar, CatTag, SevPill, Segmented, Placeholder,
});
