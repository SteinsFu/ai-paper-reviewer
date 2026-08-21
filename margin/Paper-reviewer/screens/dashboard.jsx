/* ============================================================
   Margin — Dashboard / Paper library
   ============================================================ */

function StatusPill({ status }) {
  const map = {
    "in-review": { label:"In review", color:"var(--accent-deep)", bg:"var(--accent-soft)" },
    "done":      { label:"Reviewed",  color:"var(--ok)",          bg:"var(--ok-soft)" },
    "draft":     { label:"Queued",    color:"var(--text-2)",      bg:"var(--surface-3)" },
  };
  const s = map[status] || map.draft;
  return (
    <span style={{ fontSize:11.5, fontWeight:700, color:s.color, background:s.bg,
      padding:"3px 10px", borderRadius:99 }}>{s.label}</span>
  );
}

function Dashboard({ onOpen, onNew }) {
  const D = window.DATA;
  const lib = D.LIBRARY;
  const reviewed = lib.filter(p => p.score != null);
  const avg = Math.round(reviewed.reduce((s,p)=>s+p.score,0) / reviewed.length);
  const totalIssues = lib.reduce((s,p)=>s+p.issues,0);
  const inReview = lib.filter(p=>p.status!=="done").length;

  const stats = [
    { label:"Papers in workspace", value:lib.length, ic:"doc" },
    { label:"Avg. health score", value:avg, ic:"bolt", accent:true },
    { label:"Open issues", value:totalIssues, ic:"alert" },
    { label:"Awaiting review", value:inReview, ic:"clock" },
  ];

  return (
    <div className="screen-scroll scroll anim-in">
      <div style={{ maxWidth:1080, margin:"0 auto", padding:"34px 38px 70px" }}>

        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:26, gap:20 }}>
          <div>
            <h1 style={{ fontSize:32, fontWeight:700, letterSpacing:"-0.03em", margin:"0 0 5px" }}>
              Good afternoon, Dr. Lin
            </h1>
            <p style={{ fontSize:15.5, color:"var(--text-2)", margin:0 }}>
              You have {inReview} {inReview===1?"paper":"papers"} in progress and {totalIssues} open issues across your workspace.
            </p>
          </div>
          <button className="btn btn-primary" onClick={onNew}>
            <Icon name="plus" size={17} strokeWidth={2.2}/> New review
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:30 }}>
          {stats.map((s,i) => (
            <div key={i} className="card" style={{ padding:"18px 18px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ fontSize:34, fontWeight:700, letterSpacing:"-0.03em",
                  color: s.accent ? "var(--accent-deep)" : "var(--text)" }}>{s.value}</div>
                <div style={{ width:30, height:30, borderRadius:9, display:"grid", placeItems:"center",
                  background: s.accent ? "var(--accent-soft)" : "var(--surface-3)",
                  color: s.accent ? "var(--accent-deep)" : "var(--text-2)" }}>
                  <Icon name={s.ic} size={16}/>
                </div>
              </div>
              <div style={{ fontSize:13, color:"var(--text-2)", marginTop:4, fontWeight:500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Library */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:13 }}>
          <h2 style={{ fontSize:19, fontWeight:600, margin:0, letterSpacing:"-0.02em" }}>Your papers</h2>
          <div className="seg">
            <button className="on">All</button>
            <button>In review</button>
            <button>Reviewed</button>
          </div>
        </div>

        <div className="card" style={{ overflow:"hidden", padding:0 }}>
          {lib.map((p, i) => (
            <button key={p.id} onClick={()=>onOpen(p)}
              style={{ display:"flex", alignItems:"center", gap:16, width:"100%", textAlign:"left",
                padding:"15px 20px", border:"none", borderTop: i? "1px solid var(--line-2)":"none",
                background: p.current ? "var(--accent-soft)" : "var(--surface)", transition:"background .15s" }}
              onMouseEnter={e=>{ if(!p.current) e.currentTarget.style.background="var(--surface-2)"; }}
              onMouseLeave={e=>{ if(!p.current) e.currentTarget.style.background="var(--surface)"; }}>
              <div style={{ width:40, height:50, borderRadius:7, flex:"0 0 auto",
                background:"linear-gradient(180deg,#fff,#eeeef0)", border:"1px solid var(--line)",
                display:"grid", placeItems:"center", color:"var(--text-3)", boxShadow:"var(--sh-sm)" }}>
                <Icon name="doc" size={19}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:3 }}>
                  <span style={{ fontSize:15, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden",
                    textOverflow:"ellipsis", maxWidth:380 }}>{p.title}</span>
                  {p.current && <span style={{ fontSize:11, fontWeight:700, color:"var(--accent-press)" }}>· current</span>}
                </div>
                <div style={{ fontSize:12.5, color:"var(--text-3)" }}>
                  {p.authors} · {p.venue}
                </div>
              </div>
              <StatusPill status={p.status}/>
              {p.issues > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12.5,
                  color:"var(--text-2)", fontWeight:600, minWidth:62 }}>
                  <Icon name="alert" size={14} style={{ color:"var(--warn)" }}/> {p.issues} issues
                </div>
              )}
              {p.issues === 0 && <div style={{ minWidth:62 }} />}
              <div style={{ width:50, textAlign:"right" }}>
                {p.score != null
                  ? <span style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.02em",
                      color: p.score>=85?"var(--ok)":p.score>=70?"var(--accent-deep)":"var(--critical)" }}>{p.score}</span>
                  : <span style={{ fontSize:13, color:"var(--text-4)" }}>—</span>}
              </div>
              <div style={{ fontSize:12, color:"var(--text-3)", minWidth:74, textAlign:"right" }}>{p.updated}</div>
              <Icon name="chevR" size={16} style={{ color:"var(--text-4)" }}/>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard });
