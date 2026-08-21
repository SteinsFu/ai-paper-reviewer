/* ============================================================
   Margin — Onboarding / Upload + Analyzing pipeline
   ============================================================ */

function UploadScreen({ onAnalyze }) {
  const [drag, setDrag] = useState(false);
  const D = window.DATA;
  const recent = D.LIBRARY.slice(0, 3);

  return (
    <div className="screen-scroll scroll anim-in">
      <div style={{ maxWidth: 880, margin:"0 auto", padding:"64px 32px 80px" }}>

        <div style={{ textAlign:"center", marginBottom: 44 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px",
            borderRadius:99, background:"var(--accent-soft)", color:"var(--accent-press)",
            fontSize:13, fontWeight:600, marginBottom:22 }}>
            <Icon name="spark" size={15} fill /> Peer-review copilot
          </div>
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
          onDragOver={(e)=>{e.preventDefault(); setDrag(true);}}
          onDragLeave={()=>setDrag(false)}
          onDrop={(e)=>{e.preventDefault(); setDrag(false); onAnalyze();}}
          onClick={onAnalyze}
          style={{
            border:`2px dashed ${drag ? "var(--accent)" : "var(--line-strong)"}`,
            background: drag ? "var(--accent-soft)" : "linear-gradient(180deg,#fff,var(--surface-2))",
            borderRadius: 24, padding:"52px 40px", textAlign:"center", cursor:"pointer",
            transition:"all .2s ease", boxShadow: drag ? "var(--sh-lg)" : "var(--sh-sm)",
            transform: drag ? "scale(1.008)" : "none",
          }}>
          <div style={{ width:66, height:66, borderRadius:18, margin:"0 auto 18px",
            background:"linear-gradient(145deg,var(--accent),var(--accent-deep))",
            display:"grid", placeItems:"center", boxShadow:"var(--sh-accent)" }}>
            <Icon name="upload" size={28} style={{ color:"#fff" }} strokeWidth={2}/>
          </div>
          <div style={{ fontSize:19, fontWeight:600, marginBottom:6 }}>
            Drop a paper to review
          </div>
          <div style={{ fontSize:14.5, color:"var(--text-2)", marginBottom:22 }}>
            PDF, LaTeX source, or Word — up to 60 pages
          </div>
          <button className="btn btn-primary btn-lg" onClick={(e)=>{e.stopPropagation(); onAnalyze();}}>
            <Icon name="doc" size={18}/> Choose a manuscript
          </button>
          <div style={{ marginTop:18, fontSize:12.5, color:"var(--text-3)" }}>
            or paste a DOI / arXiv link
          </div>
        </div>

        {/* What it checks */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",
          gap:12, marginTop:28 }}>
          {D.CAT_ORDER.map(id => {
            const C = D.CATEGORIES[id];
            return (
              <div key={id} className="card" style={{ padding:"14px 15px", display:"flex",
                alignItems:"center", gap:10 }}>
                <span className="dot" style={{ background:C.color, width:9, height:9 }}/>
                <span style={{ fontSize:13.5, fontWeight:600 }}>{C.label}</span>
              </div>
            );
          })}
        </div>

        {/* Recent */}
        <div style={{ marginTop:44 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--text-3)", textTransform:"uppercase",
            letterSpacing:"0.04em", marginBottom:12 }}>Continue reviewing</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {recent.map(p => (
              <button key={p.id} className="card" onClick={onAnalyze}
                style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px",
                  textAlign:"left", border:"1px solid var(--line-2)", background:"var(--surface)" }}>
                <div style={{ width:38, height:46, borderRadius:6, flex:"0 0 auto",
                  background:"linear-gradient(180deg,#fff,#f2f2f4)", border:"1px solid var(--line)",
                  display:"grid", placeItems:"center", color:"var(--text-3)" }}>
                  <Icon name="doc" size={18}/>
                </div>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontSize:14.5, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden",
                    textOverflow:"ellipsis" }}>{p.title}</div>
                  <div style={{ fontSize:12.5, color:"var(--text-3)" }}>{p.venue} · {p.updated}</div>
                </div>
                {p.score != null && (
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--text-2)" }}>{p.score}</div>
                )}
                <Icon name="chevR" size={16} style={{ color:"var(--text-4)" }}/>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Analyzing overlay ------------------------------------------------- */
function Analyzing({ onDone }) {
  const steps = window.DATA.PIPELINE;
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const per = 760;
    const timers = steps.map((_, i) => setTimeout(() => setStep(i + 1), per * (i + 1)));
    const done = setTimeout(onDone, per * steps.length + 700);
    let raf; const start = performance.now(); const total = per * steps.length + 200;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / total);
      setPct(Math.round(p * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div style={{ position:"absolute", inset:0, zIndex:50, display:"grid", placeItems:"center",
      background:"radial-gradient(800px 500px at 50% 20%, #ffffff, var(--bg))" }} className="anim-in">
      <div style={{ width:480, maxWidth:"90vw", textAlign:"center" }}>
        <div style={{ position:"relative", width:96, height:96, margin:"0 auto 28px" }}>
          <ScoreRing value={pct} size={96} stroke={7} />
          <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center" }}>
          </div>
        </div>
        <h2 style={{ fontSize:24, fontWeight:700, letterSpacing:"-0.02em", margin:"0 0 6px" }}>
          Reading your manuscript
        </h2>
        <p style={{ fontSize:14.5, color:"var(--text-2)", margin:"0 0 30px" }}>
          {window.DATA.PAPER.title.slice(0, 52)}…
        </p>

        <div className="card" style={{ padding:"10px 8px", textAlign:"left" }}>
          {steps.map((s, i) => {
            const state = i < step ? "done" : i === step ? "active" : "idle";
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:13, padding:"9px 12px",
                opacity: state === "idle" ? 0.4 : 1, transition:"opacity .4s ease" }}>
                <div style={{ width:24, height:24, borderRadius:99, flex:"0 0 auto", display:"grid",
                  placeItems:"center",
                  background: state === "done" ? "var(--accent)" : state === "active" ? "var(--accent-soft)" : "var(--surface-3)",
                  color: state === "done" ? "#fff" : "var(--accent-deep)" }}>
                  {state === "done"
                    ? <Icon name="check" size={14} strokeWidth={2.4}/>
                    : state === "active"
                      ? <span className="spin-dot" />
                      : <span style={{ width:6, height:6, borderRadius:99, background:"var(--text-4)" }}/>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600,
                    color: state === "idle" ? "var(--text-3)" : "var(--text)" }}>{s.label}</div>
                </div>
                <div style={{ fontSize:12, color:"var(--text-3)", whiteSpace:"nowrap" }}>{s.detail}</div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        .spin-dot { width:13px; height:13px; border-radius:99px; border:2px solid var(--accent-soft-2);
          border-top-color: var(--accent-deep); animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

Object.assign(window, { UploadScreen, Analyzing });
