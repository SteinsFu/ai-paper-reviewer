import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../components/Icon";
import { usePaperBundle } from "./PaperLayout";
import { useReviewState } from "../hooks/useReview";
import { RECS } from "../data/mock";
import { buildMarkdown, downloadMarkdown, printReport } from "../lib/exportReport";
import type { Recommendation } from "../services/types";

export function Report() {
  const { bundle, paperId } = usePaperBundle();
  const { report, paper, annotations } = bundle;
  const { reportEdits, userNotes, setReportEdits } = useReviewState(paperId);
  const noteCount = annotations.length + userNotes.length;
  // report fields are the AI draft overlaid with any persisted human edits
  const rec = reportEdits?.recommendation ?? report.recommendation;
  const conf = reportEdits?.confidence ?? report.confidence;
  const summary = reportEdits?.summary ?? report.summary;
  const setRec = (r: Recommendation) => setReportEdits({ recommendation: r });
  const setConf = (c: number) => setReportEdits({ confidence: c });
  const setSummary = (s: string) => setReportEdits({ summary: s });
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const exportRef = useRef<HTMLDivElement>(null);

  const overrides = { recommendation: rec, confidence: conf, summary, userNotes };

  async function copyAll() {
    await navigator.clipboard.writeText(buildMarkdown(bundle, overrides));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  // ?print=1 → triggered from the command palette
  useEffect(() => {
    if (searchParams.get("print") === "1") {
      setSearchParams({}, { replace: true });
      setTimeout(() => printReport(), 350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // close export popover on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [exportOpen]);

  return (
    <div className="screen-scroll scroll anim-in">
      <div style={{ maxWidth:900, margin:"0 auto", padding:"30px 38px 80px" }}>

        <header style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:20, marginBottom:22 }}>
          <div>
            <div className="no-print" style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:12.5, fontWeight:600,
              color:"var(--accent-press)", background:"var(--accent-soft)", padding:"4px 12px", borderRadius:99,
              marginBottom:12 }}>
              <Icon name="spark" size={14} fill/> Draft generated from {noteCount} reviewer {noteCount === 1 ? "note" : "notes"}
            </div>
            <h1 style={{ fontSize:28, fontWeight:700, letterSpacing:"-0.03em", margin:"0 0 5px" }}>Review report</h1>
            <p style={{ fontSize:14, color:"var(--text-2)", margin:0 }}>{paper.title}</p>
          </div>
          <div className="no-print" style={{ display:"flex", gap:9, flex:"0 0 auto", position:"relative" }}>
            <button className="btn" onClick={copyAll}>
              <Icon name={copied ? "check" : "quote"} size={16}/> {copied ? "Copied" : "Copy"}
            </button>
            <div ref={exportRef} style={{ position:"relative" }}>
              <button className="btn btn-primary" onClick={() => setExportOpen((o) => !o)}>
                <Icon name="download" size={16}/> Export
              </button>
              <AnimatePresence>
                {exportOpen && (
                  <motion.div className="pop"
                    initial={{ opacity:0, scale:0.96, y:-4 }} animate={{ opacity:1, scale:1, y:0 }}
                    exit={{ opacity:0, scale:0.96, y:-4 }}
                    transition={{ duration:0.16, ease:[0.22,0.61,0.36,1] }}
                    style={{ position:"absolute", right:0, top:"calc(100% + 8px)", width:230,
                      padding:6, zIndex:20 }}>
                    <ExportItem ic="doc" label="Markdown (.md)" sub="For editors & OpenReview"
                      onClick={() => { setExportOpen(false); downloadMarkdown(bundle, overrides); }}/>
                    <ExportItem ic="report" label="PDF (print)" sub="Typeset, selectable text"
                      onClick={() => { setExportOpen(false); printReport(); }}/>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Recommendation card */}
        <div className="card" style={{ padding:"20px 24px", marginBottom:18 }}>
          <div style={{ fontSize:11.5, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
            letterSpacing:"0.04em", marginBottom:12 }}>Recommendation</div>
          <div style={{ display:"flex", gap:9, marginBottom:18, flexWrap:"wrap" }}>
            {(Object.entries(RECS) as [Recommendation, typeof RECS[Recommendation]][]).map(([k, v]) => {
              const on = rec === k;
              return (
                <motion.button key={k} onClick={() => setRec(k)}
                  animate={{ scale: on ? 1.03 : 1 }}
                  transition={{ type:"spring", stiffness:480, damping:24 }}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 16px", borderRadius:11,
                    border:`1.5px solid ${on ? v.color : "var(--line)"}`, cursor:"pointer",
                    background: on ? v.color : "var(--surface)", transition:"background .15s, border-color .15s",
                    boxShadow: on ? "var(--sh)" : "none" }}>
                  <span className="dot" style={{ background: on ? "#fff" : v.color, width:9, height:9 }}/>
                  <span style={{ fontSize:14, fontWeight:600, color: on ? "#fff" : "var(--text)" }}>{v.label}</span>
                </motion.button>
              );
            })}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:13.5, fontWeight:600, color:"var(--text-2)" }}>Reviewer confidence</span>
            <div style={{ display:"flex", gap:5 }}>
              {[1,2,3,4,5].map((n) => (
                <motion.button key={n} onClick={() => setConf(n)} whileTap={{ scale:1.3 }}
                  transition={{ type:"spring", stiffness:480, damping:18 }}
                  style={{ border:"none", background:"transparent", cursor:"pointer", padding:2 }}>
                  <Icon name="star" size={20} fill={n <= conf}
                    style={{ color: n <= conf ? "var(--accent)" : "var(--text-4)" }}/>
                </motion.button>
              ))}
            </div>
            <span className="num" style={{ fontSize:12.5, color:"var(--text-3)" }}>{conf} / 5</span>
          </div>
        </div>

        {/* Report body */}
        <ReportSection num="1" title="Summary" body={summary} onBodyChange={setSummary}/>
        <ReportSection num="2" title="Strengths" items={report.strengths} tone="ok"/>
        <ReportSection num="3" title="Weaknesses" items={report.weaknesses} tone="bad"/>
        <ReportSection num="4" title="Minor comments" items={report.minor} tone="minor"/>

        <div className="no-print" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:20,
          padding:"16px 20px", background:"var(--surface-2)", borderRadius:14, border:"1px solid var(--line-2)" }}>
          <div style={{ fontSize:13, color:"var(--text-2)", display:"flex", alignItems:"center", gap:8 }}>
            <Icon name="info" size={16} style={{ color:"var(--text-3)" }}/>
            This draft is a starting point. Every line is editable — your judgment stays in control.
          </div>
          <button className="btn btn-sm" onClick={() => navigate(`/paper/${paperId}/reader`)}>
            <Icon name="chevL" size={14}/> Back to notes
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportItem({ ic, label, sub, onClick }: {
  ic: "doc" | "report"; label: string; sub: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      style={{ display:"flex", alignItems:"center", gap:11, width:"100%", textAlign:"left",
        padding:"9px 10px", borderRadius:9, border:"none", background:"transparent",
        transition:"background .12s" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-soft)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
      <span style={{ width:30, height:30, borderRadius:8, display:"grid", placeItems:"center",
        background:"var(--surface-3)", color:"var(--text-2)", flex:"0 0 auto" }}>
        <Icon name={ic} size={15}/>
      </span>
      <span>
        <span style={{ display:"block", fontSize:13.5, fontWeight:600 }}>{label}</span>
        <span style={{ display:"block", fontSize:11.5, color:"var(--text-3)" }}>{sub}</span>
      </span>
    </button>
  );
}

function ReportSection({ num, title, body, items, tone, onBodyChange }: {
  num: string; title: string; body?: string; items?: string[];
  tone?: "ok" | "bad" | "minor"; onBodyChange?: (s: string) => void;
}) {
  const dot = tone ? { ok:"var(--ok)", bad:"var(--critical)", minor:"var(--info)" }[tone] : undefined;
  const taRef = useRef<HTMLTextAreaElement>(null);

  // auto-grow the textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [body]);

  return (
    <div className="card" style={{ padding:"20px 24px", marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <span style={{ width:24, height:24, borderRadius:7, background:"var(--surface-3)",
          display:"grid", placeItems:"center", fontSize:12.5, fontWeight:700, color:"var(--text-2)" }}>{num}</span>
        <h3 style={{ fontSize:16, fontWeight:700, margin:0, letterSpacing:"-0.02em" }}>{title}</h3>
        <span className="no-print" style={{ marginLeft:"auto", fontSize:11.5, color:"var(--text-4)", fontWeight:600,
          display:"flex", alignItems:"center", gap:5 }}>
          <Icon name="pen" size={12}/> editable
        </span>
      </div>
      {body != null ? (
        <textarea ref={taRef} value={body} onChange={(e) => onBodyChange?.(e.target.value)}
          style={{ width:"100%", border:"none", outline:"none", resize:"none", overflow:"hidden",
            fontFamily:"var(--font)", fontSize:14.5, lineHeight:1.62, color:"var(--text-2)",
            background:"transparent", letterSpacing:"-0.01em" }}/>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
          {items?.map((it, i) => (
            <div key={i} style={{ display:"flex", gap:11, alignItems:"flex-start" }}>
              <span style={{ width:6, height:6, borderRadius:99, background:dot, flex:"0 0 auto", marginTop:8 }}/>
              <span style={{ fontSize:14.5, color:"var(--text-2)", lineHeight:1.55, flex:1 }}>{it}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
