import { useEffect, useState } from "react";

interface ScoreRingProps {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  sub?: string;
}

/* Animated radial score gauge. Arc fills via CSS transition; the number is
   shown directly so it's always correct even in a frozen frame. */
export function ScoreRing({ value, size = 64, stroke = 6, color = "var(--accent-deep)", sub }: ScoreRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, [value]);
  const off = mounted ? c - (value / 100) * c : c;
  return (
    <div style={{ position:"relative", width:size, height:size, flex:"0 0 auto" }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition:"stroke-dashoffset 1s cubic-bezier(.22,.61,.36,1)" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", lineHeight:1 }}>
        <div style={{ textAlign:"center" }}>
          <div className="num" style={{ fontSize:size*0.30, fontWeight:700, letterSpacing:"-0.03em" }}>{value}</div>
          {sub && <div style={{ fontSize:9, color:"var(--text-3)", fontWeight:600, marginTop:1 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}
