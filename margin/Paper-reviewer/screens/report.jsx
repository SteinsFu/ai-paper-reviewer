/* ============================================================
   Margin — Structured review report draft
   ============================================================ */

function Report({ goTo }) {
  const D = window.DATA;
  const { REPORT, RECS, PAPER } = D;
  const [rec, setRec] = useState(REPORT.recommendation);
  const [conf, setConf] = useState(REPORT.confidence);
  const [copied, setCopied] = useState(false);

  function copyAll() {
    setCopied(true); setTimeout(()=>setCopied(false), 1600);
  }

  return (
    <div className="screen-scroll scroll anim-in">
      <div style={{ maxWidth:900, margin:"0 auto", padding:"30px 38px 80px" }}>

        <header style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:20, marginBottom:22 }}>
          <div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:12.5, fontWeight:600,
              color:"var(--accent-press)", background:"var(--accent-soft)", padding:"4px 12px", borderRadius:99,
              marginBottom:12 }}>
              <Icon name="spark" size={14} fill/> Draft generated from 9 reviewer notes
            </div>
            <h1 style={{ fontSize:28, fontWeight:700, letterSpacing:"-0.03em", margin:"0 0 5px" }}>Review report</h1>
            <p style={{ fontSize:14, color:"var(--text-2)", margin:0 }}>{PAPER.title}</p>
          </div>
          <div style={{ display:"flex", gap:9, flex:"0 0 auto" }}>
            <button className="btn" onClick={copyAll}>
              <Icon name={copied?"check":"quote"} size={16}/> {copied?"Copied":"Copy"}
            </button>
            <button className="btn btn-primary">
              <Icon name="download" size={16}/> Export
            </button>
          </div>
        </header>

        {/* Recommendation card */}
        <div className="card" style={{ padding:"20px 24px", marginBottom:18 }}>
          <div style={{ fontSize:11.5, fontWeight:700, color:"var(--text-3)", textTransform:"uppercase",
            letterSpacing:"0.04em", marginBottom:12 }}>Recommendation</div>
          <div style={{ display:"flex", gap:9, marginBottom:18, flexWrap:"wrap" }}>
            {Object.entries(RECS).map(([k,v]) => {
              const on = rec === k;
              return (
                <button key={k} onClick={()=>setRec(k)}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 16px", borderRadius:11,
                    border:`1.5px solid ${on?v.color:"var(--line)"}`, cursor:"pointer",
                    background: on? v.color:"var(--surface)", transition:"all .15s",
                    boxShadow: on?"var(--sh)":"none" }}>
                  <span className="dot" style={{ background: on?"#fff":v.color, width:9, height:9 }}/>
                  <span style={{ fontSize:14, fontWeight:600, color: on?"#fff":"var(--text)" }}>{v.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:13.5, fontWeight:600, color:"var(--text-2)" }}>Reviewer confidence</span>
            <div style={{ display:"flex", gap:5 }}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>setConf(n)}
                  style={{ border:"none", background:"transparent", cursor:"pointer", padding:2 }}>
                  <Icon name="star" size={20} fill={n<=conf}
                    style={{ color: n<=conf?"var(--accent)":"var(--text-4)" }}/>
                </button>
              ))}
            </div>
            <span style={{ fontSize:12.5, color:"var(--text-3)" }}>{conf} / 5</span>
          </div>
        </div>

        {/* Report body */}
        <ReportSection num="1" title="Summary" body={REPORT.summary}/>
        <ReportSection num="2" title="Strengths" items={REPORT.strengths} tone="ok"/>
        <ReportSection num="3" title="Weaknesses" items={REPORT.weaknesses} tone="bad"/>
        <ReportSection num="4" title="Minor comments" items={REPORT.minor} tone="minor"/>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:20,
          padding:"16px 20px", background:"var(--surface-2)", borderRadius:14, border:"1px solid var(--line-2)" }}>
          <div style={{ fontSize:13, color:"var(--text-2)", display:"flex", alignItems:"center", gap:8 }}>
            <Icon name="info" size={16} style={{ color:"var(--text-3)" }}/>
            This draft is a starting point. Every line is editable — your judgment stays in control.
          </div>
          <button className="btn btn-sm" onClick={()=>goTo("reader")}>
            <Icon name="chevL" size={14}/> Back to notes
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportSection({ num, title, body, items, tone }) {
  const [text, setText] = useState(body || "");
  const dot = { ok:"var(--ok)", bad:"var(--critical)", minor:"var(--info)" }[tone];
  return (
    <div className="card" style={{ padding:"20px 24px", marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <span style={{ width:24, height:24, borderRadius:7, background:"var(--surface-3)",
          display:"grid", placeItems:"center", fontSize:12.5, fontWeight:700, color:"var(--text-2)" }}>{num}</span>
        <h3 style={{ fontSize:16, fontWeight:700, margin:0, letterSpacing:"-0.02em" }}>{title}</h3>
        <span style={{ marginLeft:"auto", fontSize:11.5, color:"var(--text-4)", fontWeight:600,
          display:"flex", alignItems:"center", gap:5 }}>
          <Icon name="pen" size={12}/> editable
        </span>
      </div>
      {body != null ? (
        <textarea defaultValue={text} onChange={e=>setText(e.target.value)}
          style={{ width:"100%", border:"none", outline:"none", resize:"vertical", minHeight:96,
            fontFamily:"var(--font)", fontSize:14.5, lineHeight:1.62, color:"var(--text-2)",
            background:"transparent", letterSpacing:"-0.01em" }}/>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
          {items.map((it,i)=>(
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

Object.assign(window, { Report });
