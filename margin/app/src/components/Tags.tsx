import type { CSSProperties } from "react";
import { CATEGORIES, SEVERITY } from "../data/mock";
import type { CategoryId, SeverityId } from "../services/types";

export function CatTag({ cat, small }: { cat: CategoryId; small?: boolean }) {
  const C = CATEGORIES[cat];
  return (
    <span className="chip" style={{ background:C.soft, color:C.color,
      height: small?22:26, fontSize: small?11.5:12.5, paddingInline: small?9:11 }}>
      <span className="dot" style={{ background:C.color, width:7, height:7 }} />
      {C.label}
    </span>
  );
}

export function SevPill({ sev }: { sev: SeverityId }) {
  const S = SEVERITY[sev];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11.5, fontWeight:700,
      color:S.color, background:S.soft, padding:"2px 9px", borderRadius:99 }}>
      <span className="dot" style={{ background:S.color, width:6, height:6 }}/>
      {S.label}
    </span>
  );
}

export function StatusPill({ status }: { status: "in-review" | "done" | "draft" }) {
  const map = {
    "in-review": { label:"In review", color:"var(--accent-deep)", bg:"var(--accent-soft)" },
    "done":      { label:"Reviewed",  color:"var(--ok)",          bg:"var(--ok-soft)" },
    "draft":     { label:"Queued",    color:"var(--text-2)",      bg:"var(--surface-3)" },
  };
  const s = map[status] ?? map.draft;
  return (
    <span style={{ fontSize:11.5, fontWeight:700, color:s.color, background:s.bg,
      padding:"3px 10px", borderRadius:99, whiteSpace:"nowrap" }}>{s.label}</span>
  );
}

/* numbered annotation marker badge */
export function Marker({ n, sev, resolved, inline, style }: {
  n: number; sev: SeverityId; resolved?: boolean; inline?: boolean; style?: CSSProperties;
}) {
  const S = SEVERITY[sev];
  return (
    <span style={{ display:"inline-grid", placeItems:"center",
      width: inline?15:21, height: inline?15:21, borderRadius:99,
      fontSize: inline?9:11, fontWeight:700, flex:"0 0 auto",
      background: resolved? "var(--surface-3)" : S.color,
      color: resolved? "var(--text-3)" : "#fff",
      marginLeft: inline?3:0, verticalAlign:"middle",
      boxShadow: inline? "none":"var(--sh-sm)",
      transition:"background .25s ease, color .25s ease", ...style }}>
      {resolved ? "✓" : n}
    </span>
  );
}
