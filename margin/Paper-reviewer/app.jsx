/* ============================================================
   Margin — App shell, routing, navigation
   ============================================================ */

const NAV = {
  workspace: [
    { id:"dashboard", label:"Dashboard", ic:"home" },
    { id:"upload",    label:"New review", ic:"plus" },
  ],
  paper: [
    { id:"reader",  label:"Reviewer notes",     ic:"doc",     badge:9 },
    { id:"visual",  label:"Visual feedback",    ic:"eye" },
    { id:"novelty", label:"Novelty & citations", ic:"compass" },
    { id:"report",  label:"Review report",      ic:"report" },
  ],
};

const TITLES = {
  dashboard:"Dashboard", upload:"New review", reader:"Reviewer notes",
  visual:"Visual feedback", novelty:"Novelty & citations", report:"Review report",
};

function App() {
  const D = window.DATA;
  const [route, setRoute] = useState("dashboard");
  const [analyzing, setAnalyzing] = useState(false);
  const [hasPaper, setHasPaper] = useState(true); // current paper loaded

  function goTo(r) { setRoute(r); }
  function goUpload() { setRoute("upload"); }
  function finishAnalyze() {
    setAnalyzing(false);
    setHasPaper(true);
    setRoute("reader");
  }
  function openPaper(p) {
    if (p.status === "draft") { goUpload(); }
    else { setHasPaper(true); setRoute("reader"); }
  }

  const paperNav = hasPaper;

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-name">Margin</div>
            <div className="brand-sub">Peer-review copilot</div>
          </div>
        </div>

        <div className="nav-label">Workspace</div>
        {NAV.workspace.map(n => (
          <button key={n.id} className={"nav-item" + (route===n.id?" active":"")}
            onClick={()=> n.id==="upload" ? goUpload() : goTo(n.id)}>
            <Icon name={n.ic} className="nav-ic" size={18}/>
            <span>{n.label}</span>
          </button>
        ))}

        {paperNav && (
          <>
            <div className="nav-label">Current paper</div>
            <div style={{ padding:"0 10px 8px" }}>
              <div style={{ display:"flex", gap:10, alignItems:"center", padding:"9px 11px",
                background:"var(--surface)", borderRadius:11, boxShadow:"var(--sh-sm)",
                border:"1px solid var(--line-2)" }}>
                <div style={{ width:26, height:32, borderRadius:5, flex:"0 0 auto",
                  background:"linear-gradient(180deg,#fff,#eeeef0)", border:"1px solid var(--line)",
                  display:"grid", placeItems:"center", color:"var(--text-3)" }}>
                  <Icon name="doc" size={13}/>
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:600, lineHeight:1.25,
                    display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                    Attention-Guided Summarization…
                  </div>
                </div>
              </div>
            </div>
            {NAV.paper.map(n => (
              <button key={n.id} className={"nav-item" + (route===n.id?" active":"")}
                onClick={()=>goTo(n.id)}>
                <Icon name={n.ic} className="nav-ic" size={18}/>
                <span>{n.label}</span>
                {n.badge && <span className={"nav-badge"+(route===n.id?"":" muted")}>{n.badge}</span>}
              </button>
            ))}
          </>
        )}

        <div style={{ marginTop:"auto" }}>
          <div className="card" style={{ padding:"13px 14px", background:"linear-gradient(160deg,var(--accent-soft),#fff)",
            border:"1px solid var(--accent-soft-2)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
              <Icon name="bolt" size={15} fill style={{ color:"var(--accent-deep)" }}/>
              <span style={{ fontSize:13, fontWeight:700 }}>Margin Pro</span>
            </div>
            <div style={{ fontSize:11.5, color:"var(--text-2)", lineHeight:1.4 }}>
              Unlimited reviews & literature retrieval across 2.1M papers.
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 8px 2px" }}>
            <div style={{ width:30, height:30, borderRadius:99, background:"linear-gradient(145deg,#c9c9ce,#9a9aa0)",
              display:"grid", placeItems:"center", color:"#fff", fontSize:12, fontWeight:700 }}>JL</div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:12.5, fontWeight:600 }}>Dr. Jordan Lin</div>
              <div style={{ fontSize:11, color:"var(--text-3)" }}>Faculty · HCI Lab</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="topbar">
          <h1>{TITLES[route]}</h1>
          {paperNav && route!=="dashboard" && route!=="upload" && (
            <>
              <span className="crumb">·</span>
              <span className="crumb" style={{ maxWidth:340, overflow:"hidden", textOverflow:"ellipsis",
                whiteSpace:"nowrap" }}>SciSumm · CHI 2026</span>
              <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:7 }}>
                <span style={{ fontSize:12.5, color:"var(--text-2)", fontWeight:500 }}>Health</span>
                <span style={{ fontSize:14, fontWeight:700, color:"var(--accent-deep)" }}>{D.PAPER.overall}</span>
                <span style={{ fontSize:12.5, color:"var(--text-4)" }}>/100</span>
              </div>
            </>
          )}
        </div>

        <div className="screen">
          {analyzing && <Analyzing onDone={finishAnalyze}/>}
          <div key={route} style={{ height:"100%" }}>
            {route==="dashboard" && <Dashboard onOpen={openPaper} onNew={goUpload}/>}
            {route==="upload"   && <UploadScreen onAnalyze={()=>setAnalyzing(true)}/>}
            {route==="reader"   && <Reader goTo={goTo}/>}
            {route==="visual"   && <VisualFeedback goTo={goTo}/>}
            {route==="novelty"  && <Novelty goTo={goTo}/>}
            {route==="report"   && <Report goTo={goTo}/>}
          </div>
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
