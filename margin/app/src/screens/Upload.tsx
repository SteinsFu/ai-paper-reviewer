import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Icon } from "../components/Icon";
import { Analyzing } from "./Analyzing";
import { useLibrary } from "../hooks/useReview";
import { api } from "../services";
import { libraryStore } from "../services/libraryStore";
import { invalidateReviewCache } from "../services/searchIndex";
import { CATEGORIES, CAT_ORDER } from "../data/mock";

export function Upload() {
  const [drag, setDrag] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { data: lib } = useLibrary();
  const navigate = useNavigate();
  const recent = (lib ?? []).slice(0, 3);

  function startAnalyzeWith(picked: File | null) { setFile(picked); setAnalyzing(true); }
  function openPicker() { fileInputRef.current?.click(); }
  async function finishAnalyze(paperId: string) {
    invalidateReviewCache();
    try { libraryStore.replace(await api.getLibrary()); } catch { /* sidebar refetches on next visit */ }
    navigate(`/paper/${paperId}/reader`);
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md"
        style={{ display: "none" }}
        onChange={(e) => {
          const picked = e.target.files?.[0] ?? null;
          if (picked) startAnalyzeWith(picked);
          e.target.value = ""; // let the same file trigger onChange again if re-selected
        }}
      />
      {analyzing && <Analyzing file={file} onDone={finishAnalyze}/>}
      <div className="screen-scroll scroll anim-in">
        <div style={{ maxWidth:880, margin:"0 auto", padding:"64px 32px 80px" }}>

          <div style={{ textAlign:"center", marginBottom:44 }}>
            <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
              style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px",
                borderRadius:99, background:"var(--accent-soft)", color:"var(--accent-press)",
                fontSize:13, fontWeight:600, marginBottom:22 }}>
              <Icon name="spark" size={15} fill/> Peer-review copilot
            </motion.div>
            <h1 style={{ fontSize:46, fontWeight:700, letterSpacing:"-0.03em", margin:"0 0 14px", lineHeight:1.05 }}>
              Review smarter.<br/>Write stronger.
            </h1>
            <p style={{ fontSize:18, color:"var(--text-2)", maxWidth:520, margin:"0 auto", lineHeight:1.5 }}>
              Drop in a manuscript and Margin reads it the way a careful reviewer would —
              structure, methodology, novelty, citations, and the writing itself.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const picked = e.dataTransfer.files?.[0] ?? null;
              if (picked) startAnalyzeWith(picked);
              else openPicker();
            }}
            onClick={openPicker}
            style={{
              border:`2px dashed ${drag ? "var(--accent)" : "var(--line-strong)"}`,
              background: drag ? "var(--accent-soft)" : "var(--grad-card)",
              borderRadius:24, padding:"52px 40px", textAlign:"center", cursor:"pointer",
              transition:"all .2s ease", boxShadow: drag ? "var(--sh-lg)" : "var(--sh-sm)",
              transform: drag ? "scale(1.008)" : "none",
            }}>
            <motion.div
              animate={drag ? { y: [0, -6, 0] } : { y: 0 }}
              transition={drag ? { repeat: Infinity, duration: 1.1, ease: "easeInOut" } : {}}
              style={{ width:66, height:66, borderRadius:18, margin:"0 auto 18px",
                background:"linear-gradient(145deg,var(--accent),var(--accent-deep))",
                display:"grid", placeItems:"center", boxShadow:"var(--sh-accent)" }}>
              <Icon name="upload" size={28} style={{ color:"#fff" }} strokeWidth={2}/>
            </motion.div>
            <div style={{ fontSize:19, fontWeight:600, marginBottom:6 }}>
              Drop a paper to review
            </div>
            <div style={{ fontSize:14.5, color:"var(--text-2)", marginBottom:22 }}>
              PDF, LaTeX source, or Word — up to 60 pages / 50 MB
            </div>
            <button className="btn btn-primary btn-lg" onClick={(e) => { e.stopPropagation(); openPicker(); }}>
              <Icon name="doc" size={18}/> Choose a manuscript
            </button>
            <div style={{ marginTop:18, fontSize:12.5, color:"var(--text-3)" }}>
              or paste a DOI / arXiv link
            </div>
          </div>

          {/* What it checks */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",
            gap:12, marginTop:28 }}>
            {CAT_ORDER.map((id, i) => {
              const C = CATEGORIES[id];
              return (
                <motion.div key={id} className="card card-hover"
                  initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                  transition={{ delay: 0.2 + i * 0.045, type:"spring", stiffness:380, damping:32 }}
                  style={{ padding:"14px 15px", display:"flex", alignItems:"center", gap:10 }}>
                  <span className="dot" style={{ background:C.color, width:9, height:9 }}/>
                  <span style={{ fontSize:13.5, fontWeight:600 }}>{C.label}</span>
                </motion.div>
              );
            })}
          </div>

          {/* Recent */}
          {recent.length > 0 && (
            <div style={{ marginTop:44 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--text-3)", textTransform:"uppercase",
                letterSpacing:"0.04em", marginBottom:12 }}>Continue reviewing</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {recent.map((p) => (
                  <button key={p.id} className="card card-hover"
                    onClick={() => p.status === "draft" ? openPicker() : navigate(`/paper/${p.id}/reader`)}
                    style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px",
                      textAlign:"left", border:"1px solid var(--line-2)", background:"var(--surface)" }}>
                    <div style={{ width:38, height:46, borderRadius:6, flex:"0 0 auto",
                      background:"var(--grad-thumb)", border:"1px solid var(--line)",
                      display:"grid", placeItems:"center", color:"var(--text-3)" }}>
                      <Icon name="doc" size={18}/>
                    </div>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontSize:14.5, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden",
                        textOverflow:"ellipsis" }}>{p.title}</div>
                      <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{p.venue} · {p.updated}</div>
                    </div>
                    {p.score != null && (
                      <div className="num" style={{ fontSize:13, fontWeight:700, color:"var(--text-2)" }}>{p.score}</div>
                    )}
                    <Icon name="chevR" size={16} style={{ color:"var(--text-4)" }}/>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
