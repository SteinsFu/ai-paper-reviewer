/* ============================================================
   Margin — Visual feedback (annotated before / after)
   ============================================================ */

function VisualFeedback({ goTo }) {
  const D = window.DATA;
  const { VISUALS, CATEGORIES } = D;
  const [active, setActive] = useState(VISUALS[0].id);
  const item = VISUALS.find(v => v.id === active);

  return (
    <div className="screen-scroll scroll anim-in">
      <div style={{ maxWidth:1080, margin:"0 auto", padding:"30px 38px 70px" }}>
        <header style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:28, fontWeight:700, letterSpacing:"-0.03em", margin:"0 0 6px" }}>Visual feedback</h1>
          <p style={{ fontSize:15.5, color:"var(--text-2)", margin:0, maxWidth:620 }}>
            Margin captures the exact spots that trip readers up — a muddy figure, a dense paragraph —
            and shows a cleaner version side by side.
          </p>
        </header>

        <div style={{ display:"flex", gap:24, alignItems:"flex-start" }}>
          {/* list */}
          <div style={{ width:268, flex:"0 0 268px", display:"flex", flexDirection:"column", gap:9 }}>
            {VISUALS.map(v => {
              const C = CATEGORIES[v.cat]; const on = v.id === active;
              return (
                <button key={v.id} onClick={()=>setActive(v.id)}
                  style={{ textAlign:"left", padding:"13px 14px", borderRadius:13, cursor:"pointer",
                    border:`1px solid ${on?C.color:"var(--line-2)"}`,
                    background: on? "var(--surface)":"var(--surface-2)",
                    boxShadow: on?"var(--sh)":"none", transition:"all .15s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
                    <span style={{ width:26, height:26, borderRadius:7, display:"grid", placeItems:"center",
                      background:C.soft, color:C.color, flex:"0 0 auto" }}>
                      <Icon name={v.kind==="figure"?"grid":"quote"} size={14}/>
                    </span>
                    <SevPill sev={v.sev}/>
                  </div>
                  <div style={{ fontSize:14, fontWeight:600, letterSpacing:"-0.01em", marginBottom:3 }}>{v.title}</div>
                  <div style={{ fontSize:12, color:"var(--text-3)", lineHeight:1.4 }}>{v.problem}</div>
                </button>
              );
            })}
          </div>

          {/* before / after */}
          <div style={{ flex:1, minWidth:0 }}>
            <div className="card" style={{ padding:0, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 20px",
                borderBottom:"1px solid var(--line-2)" }}>
                <CatTag cat={item.cat} small/>
                <span style={{ fontSize:15, fontWeight:600 }}>{item.title}</span>
                <span style={{ marginLeft:"auto" }}><SevPill sev={item.sev}/></span>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:0 }}>
                {/* BEFORE */}
                <div style={{ padding:"20px 22px", borderRight:"1px solid var(--line-2)" }}>
                  <PanelLabel tone="bad" text={item.beforeLabel || "as submitted"} />
                  {item.kind === "figure"
                    ? <BeforeFigure/>
                    : <BeforeText text={item.before}/>}
                  {item.metricBefore && <Metric tone="bad" text={item.metricBefore}/>}
                </div>
                {/* AFTER */}
                <div style={{ padding:"20px 22px", background:"linear-gradient(180deg,var(--accent-soft),transparent 60%)" }}>
                  <PanelLabel tone="good" text={item.afterLabel || "suggested"} />
                  {item.kind === "figure"
                    ? <AfterFigure/>
                    : <AfterText text={item.after}/>}
                  {item.metricAfter && <Metric tone="good" text={item.metricAfter}/>}
                </div>
              </div>

              <div style={{ padding:"15px 20px", borderTop:"1px solid var(--line-2)",
                background:"var(--surface-2)", display:"flex", alignItems:"center", gap:12 }}>
                <Icon name="spark" size={16} fill style={{ color:"var(--accent-deep)", flex:"0 0 auto" }}/>
                <div style={{ fontSize:13.5, color:"var(--text)", lineHeight:1.45, flex:1 }}>
                  <strong style={{ fontWeight:600 }}>How to fix: </strong>{item.fix || item.problem}
                </div>
                <button className="btn btn-primary btn-sm" onClick={()=>goTo("reader")}>
                  <Icon name="pen" size={14}/> Open in reader
                </button>
              </div>
            </div>

            <div style={{ display:"flex", gap:12, marginTop:14 }}>
              <InfoNote ic="eye" title="Annotated capture"
                body="Margin marks the precise region — pixel coordinates for figures, character spans for text."/>
              <InfoNote ic="book" title="Grounded in good writing"
                body="Each suggestion is paired with an example of strong academic style for the same situation."/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelLabel({ tone, text }) {
  const good = tone === "good";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:14 }}>
      <span style={{ width:8, height:8, borderRadius:99,
        background: good? "var(--ok)":"var(--critical)" }}/>
      <span style={{ fontFamily:"var(--mono)", fontSize:11, letterSpacing:"0.04em",
        textTransform:"uppercase", color: good?"var(--ok)":"var(--critical)", fontWeight:600 }}>{text}</span>
    </div>
  );
}
function Metric({ tone, text }) {
  const good = tone === "good";
  return (
    <div style={{ marginTop:14, fontSize:12, fontFamily:"var(--mono)", fontWeight:600,
      color: good?"var(--ok)":"var(--critical)" }}>{text}</div>
  );
}
function BeforeText({ text }) {
  return (
    <p style={{ fontFamily:"var(--font-serif)", fontSize:15.5, lineHeight:1.65, margin:0, color:"#3a3a3d",
      background:"var(--critical-soft)", padding:"14px 15px", borderRadius:10,
      textDecoration:"underline", textDecorationColor:"var(--critical)", textDecorationStyle:"wavy",
      textDecorationThickness:"1.5px", textUnderlineOffset:"3px" }}>{text}</p>
  );
}
function AfterText({ text }) {
  return (
    <p style={{ fontFamily:"var(--font-serif)", fontSize:15.5, lineHeight:1.65, margin:0, color:"var(--text)",
      background:"var(--surface)", padding:"14px 15px", borderRadius:10, border:"1px solid var(--ok-soft)",
      boxShadow:"var(--sh-sm)" }}>{text}</p>
  );
}
function BeforeFigure() {
  const bars=[62,78,90,70];
  return (
    <div style={{ position:"relative", background:"#fff", border:"1px solid var(--line)", borderRadius:10,
      padding:"18px 20px", height:170 }}>
      <div style={{ display:"flex", alignItems:"flex-end", gap:18, height:"100%" }}>
        {bars.map((h,i)=><div key={i} style={{ flex:1, height:`${h}%`, background:"var(--text-4)",
          borderRadius:"4px 4px 0 0" }}/>)}
      </div>
      <span style={{ position:"absolute", top:"30%", left:"30%", background:"var(--critical)", color:"#fff",
        fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:99, transform:"rotate(-6deg)",
        boxShadow:"var(--sh)" }}>no error bars</span>
      <span style={{ position:"absolute", bottom:8, left:14, fontFamily:"var(--mono)", fontSize:10,
        color:"var(--text-4)" }}>y-axis unlabeled</span>
    </div>
  );
}
function AfterFigure() {
  const bars=[62,78,90,70];
  return (
    <div style={{ position:"relative", background:"#fff", border:"1px solid var(--ok-soft)", borderRadius:10,
      padding:"18px 20px 18px 34px", height:170, boxShadow:"var(--sh-sm)" }}>
      <span style={{ position:"absolute", left:8, top:"50%", transform:"rotate(-90deg) translateX(50%)",
        transformOrigin:"left", fontFamily:"var(--mono)", fontSize:9, color:"var(--text-3)", whiteSpace:"nowrap" }}>
        Mean rating (1–7)</span>
      <div style={{ display:"flex", alignItems:"flex-end", gap:18, height:"100%" }}>
        {bars.map((h,i)=>(
          <div key={i} style={{ flex:1, height:`${h}%`, position:"relative",
            background: i>=2?"var(--accent)":"var(--text-3)", borderRadius:"4px 4px 0 0" }}>
            {/* error bar */}
            <span style={{ position:"absolute", top:-8, left:"50%", width:2, height:18, marginLeft:-1,
              background:"var(--text)", borderRadius:2 }}/>
            <span style={{ position:"absolute", top:-9, left:"50%", width:10, height:2, marginLeft:-5,
              background:"var(--text)" }}/>
          </div>
        ))}
      </div>
    </div>
  );
}
function InfoNote({ ic, title, body }) {
  return (
    <div className="card" style={{ padding:"15px 17px", flex:1, display:"flex", gap:12 }}>
      <span style={{ width:32, height:32, borderRadius:9, flex:"0 0 auto", display:"grid", placeItems:"center",
        background:"var(--accent-soft)", color:"var(--accent-deep)" }}><Icon name={ic} size={17}/></span>
      <div>
        <div style={{ fontSize:13.5, fontWeight:600, marginBottom:3 }}>{title}</div>
        <div style={{ fontSize:12.5, color:"var(--text-2)", lineHeight:1.45 }}>{body}</div>
      </div>
    </div>
  );
}

Object.assign(window, { VisualFeedback });
