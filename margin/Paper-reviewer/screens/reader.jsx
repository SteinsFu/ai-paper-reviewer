/* ============================================================
   Margin — Manuscript reader with inline annotations
   ============================================================ */

function Reader({ goTo }) {
  const D = window.DATA;
  const { MANUSCRIPT, ANNOTATIONS, CATEGORIES, SEVERITY, PAPER, SCORES, CAT_ORDER } = D;

  const [selected, setSelected] = useState(null);
  const [catFilter, setCatFilter] = useState("all");
  const [resolved, setResolved] = useState({});
  const [applied, setApplied] = useState({});

  const docRef = useRef(null);
  const railRef = useRef(null);
  const spanRefs = useRef({});
  const cardRefs = useRef({});

  const annoById = useMemo(() => Object.fromEntries(ANNOTATIONS.map(a => [a.id, a])), []);

  const visible = ANNOTATIONS.filter(a => catFilter === "all" || a.cat === catFilter);
  const openCount = ANNOTATIONS.filter(a => !resolved[a.id]).length;

  // scroll helpers (no scrollIntoView)
  function scrollToSpan(id) {
    const el = spanRefs.current[id]; const cont = docRef.current;
    if (!el || !cont) return;
    const top = el.offsetTop - cont.clientHeight * 0.34;
    cont.scrollTo({ top, behavior:"smooth" });
  }
  function scrollToCard(id) {
    const el = cardRefs.current[id]; const cont = railRef.current;
    if (!el || !cont) return;
    cont.scrollTo({ top: el.offsetTop - 14, behavior:"smooth" });
  }
  function selectAnno(id, from) {
    setSelected(id);
    if (from !== "doc") scrollToSpan(id);
    if (from !== "rail") scrollToCard(id);
  }

  const sevOrder = { critical:0, moderate:1, minor:2 };
  const sortedVisible = [...visible].sort((a,b)=> sevOrder[a.sev]-sevOrder[b.sev]);

  // marker index map (1..n) by document order
  const markerIndex = useMemo(() => {
    const m = {}; ANNOTATIONS.forEach((a,i)=> m[a.id]=i+1); return m;
  }, []);

  return (
    <div style={{ display:"flex", height:"100%", minHeight:0 }} className="anim-in">

      {/* ============ Manuscript column ============ */}
      <div style={{ flex:"1 1 auto", minWidth:0, display:"flex", flexDirection:"column" }}>

        {/* paper header */}
        <div style={{ padding:"20px 40px 16px", borderBottom:"1px solid var(--line-2)",
          background:"linear-gradient(180deg,#fff,var(--surface-2))" }}>
          <div style={{ display:"flex", gap:22, alignItems:"flex-start" }}>
            <ScoreRing value={PAPER.overall} size={62} stroke={6} sub="HEALTH"/>
            <div style={{ flex:1, minWidth:0 }}>
              <h1 style={{ fontSize:20, fontWeight:700, letterSpacing:"-0.02em", margin:"0 0 4px",
                lineHeight:1.25 }}>{PAPER.title}</h1>
              <div style={{ fontSize:13, color:"var(--text-2)" }}>
                {PAPER.authors} · {PAPER.venue}
              </div>
              <div style={{ display:"flex", gap:7, marginTop:12, flexWrap:"wrap" }}>
                {CAT_ORDER.map(id => {
                  const C = CATEGORIES[id]; const sc = SCORES[id];
                  const on = catFilter === id;
                  return (
                    <button key={id} onClick={()=>setCatFilter(on?"all":id)}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px 4px 8px",
                        borderRadius:99, border:`1px solid ${on?C.color:"var(--line)"}`,
                        background: on? C.soft : "var(--surface)", cursor:"pointer",
                        transition:"all .15s" }}>
                      <span className="dot" style={{ background:C.color, width:7, height:7 }}/>
                      <span style={{ fontSize:12, fontWeight:600, color: on?C.color:"var(--text-2)" }}>{C.label}</span>
                      <span style={{ fontSize:12, fontWeight:700, color: sc>=85?"var(--ok)":sc>=70?"var(--text)":"var(--critical)" }}>{sc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* the document */}
        <div ref={docRef} className="scroll" style={{ flex:1, minHeight:0, padding:"40px 0 120px" }}>
          <div style={{ maxWidth:720, margin:"0 auto", padding:"0 44px" }}>
            {MANUSCRIPT.map((blk, bi) => {
              if (blk.type === "h1")
                return <h2 key={bi} style={{ fontSize:21, fontWeight:700, letterSpacing:"-0.02em",
                  margin: bi? "38px 0 14px":"0 0 14px", color:"var(--text)" }}>{blk.runs[0].t}</h2>;
              if (blk.type === "fig") {
                const an = annoById[blk.anno];
                const isSel = selected === blk.anno;
                return (
                  <figure key={bi} style={{ margin:"22px 0" }}>
                    <div onClick={()=>selectAnno(blk.anno,"doc")}
                      style={{ cursor:"pointer", borderRadius:12, position:"relative",
                        outline: isSel? "2px solid var(--warn)":"2px solid transparent",
                        outlineOffset:3, transition:"outline .15s" }}>
                      <FigurePlaceholder/>
                      <Marker n={markerIndex[blk.anno]} sev={an.sev} resolved={resolved[an.id]}
                        style={{ position:"absolute", top:10, right:10 }}/>
                    </div>
                    <figcaption style={{ fontSize:12.5, color:"var(--text-3)", marginTop:8, fontStyle:"italic",
                      textAlign:"center" }}>{blk.caption}</figcaption>
                  </figure>
                );
              }
              // paragraph
              return (
                <p key={bi} style={{ fontFamily:"var(--font-serif)", fontSize:17, lineHeight:1.72,
                  margin:"0 0 17px", color:"#2a2a2d", letterSpacing:0 }}>
                  {blk.runs.map((r, ri) => {
                    if (!r.a) return <span key={ri}>{r.t}</span>;
                    const an = annoById[r.a];
                    const S = SEVERITY[an.sev];
                    const isSel = selected === r.a;
                    const isDone = resolved[r.a];
                    return (
                      <mark key={ri}
                        ref={el => spanRefs.current[r.a] = el}
                        onClick={()=>selectAnno(r.a,"doc")}
                        style={{
                          background: isDone ? "transparent" : isSel ? S.soft : "transparent",
                          backgroundImage: isDone ? "none"
                            : `linear-gradient(${isSel?S.soft:"transparent"},${isSel?S.soft:"transparent"})`,
                          color:"inherit", cursor:"pointer", borderRadius:4,
                          padding:"1px 2px", margin:"0 -2px",
                          textDecoration: isDone ? "none" : "underline",
                          textDecorationColor: isDone ? "transparent" : S.color,
                          textDecorationThickness:"2px", textUnderlineOffset:"3px",
                          textDecorationStyle:"wavy",
                          opacity: isDone? 0.55 : 1,
                          transition:"background .15s, opacity .2s",
                        }}>
                        {r.t}
                        <sup><Marker n={markerIndex[r.a]} sev={an.sev} resolved={isDone} inline/></sup>
                      </mark>
                    );
                  })}
                </p>
              );
            })}
            <div style={{ textAlign:"center", color:"var(--text-4)", fontSize:12.5, marginTop:30 }}>
              ··· {PAPER.pages} pages · {PAPER.words.toLocaleString()} words · {PAPER.refs} references ···
            </div>
          </div>
        </div>
      </div>

      {/* ============ Annotation rail ============ */}
      <div style={{ width:392, flex:"0 0 392px", borderLeft:"1px solid var(--line-2)",
        display:"flex", flexDirection:"column", background:"var(--surface-2)" }}>
        <div style={{ padding:"16px 18px 13px", borderBottom:"1px solid var(--line-2)",
          background:"rgba(251,251,253,0.8)", backdropFilter:"blur(12px)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <h2 style={{ fontSize:16, fontWeight:700, margin:0, letterSpacing:"-0.02em" }}>Reviewer notes</h2>
              <span className="chip" style={{ height:21, fontSize:11.5, background:"var(--accent-soft)",
                color:"var(--accent-press)" }}>{openCount} open</span>
            </div>
            <button className="btn btn-sm" onClick={()=>goTo("report")}>
              <Icon name="report" size={15}/> Report
            </button>
          </div>
          {catFilter !== "all" && (
            <button onClick={()=>setCatFilter("all")} style={{ marginTop:10, border:"none",
              background:"transparent", color:"var(--accent-press)", fontSize:12.5, fontWeight:600,
              cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:5 }}>
              <Icon name="close" size={13}/> Clear filter · {CATEGORIES[catFilter].label}
            </button>
          )}
        </div>

        <div ref={railRef} className="scroll" style={{ flex:1, minHeight:0, padding:"12px 14px 60px" }}>
          {sortedVisible.length === 0 && (
            <div style={{ textAlign:"center", color:"var(--text-3)", padding:"50px 20px", fontSize:14 }}>
              No notes in this category.
            </div>
          )}
          {sortedVisible.map(an => {
            const C = CATEGORIES[an.cat]; const S = SEVERITY[an.sev];
            const isSel = selected === an.id; const isDone = resolved[an.id];
            return (
              <div key={an.id} ref={el => cardRefs.current[an.id]=el}
                onClick={()=>selectAnno(an.id,"rail")}
                style={{ background:"var(--surface)", border:`1px solid ${isSel?C.color:"var(--line-2)"}`,
                  borderRadius:14, padding:"13px 14px", marginBottom:9, cursor:"pointer",
                  boxShadow: isSel? "var(--sh)":"var(--sh-sm)", transition:"all .15s",
                  opacity: isDone? 0.62 : 1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <Marker n={markerIndex[an.id]} sev={an.sev} resolved={isDone}/>
                  <CatTag cat={an.cat} small/>
                  <span style={{ marginLeft:"auto" }}><SevPill sev={an.sev}/></span>
                </div>
                <div style={{ fontSize:14.5, fontWeight:600, marginBottom:6, letterSpacing:"-0.01em",
                  textDecoration: isDone?"line-through":"none", color: isDone?"var(--text-2)":"var(--text)" }}>
                  {an.title}
                </div>
                <div style={{ fontSize:12.5, color:"var(--text-3)", fontStyle:"italic", marginBottom:9,
                  paddingLeft:10, borderLeft:`2px solid ${S.color}`, lineHeight:1.45 }}>
                  "{an.excerpt}"
                </div>
                <div style={{ fontSize:13.5, color:"var(--text-2)", lineHeight:1.5, marginBottom: an.suggestion?10:0 }}>
                  {an.comment}
                </div>

                {isSel && an.suggestion && (
                  <div className="anim-in" style={{ marginTop:4 }}>
                    <div style={{ background:"var(--accent-soft)", border:"1px solid var(--accent-soft-2)",
                      borderRadius:10, padding:"10px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11.5, fontWeight:700,
                        color:"var(--accent-press)", textTransform:"uppercase", letterSpacing:"0.03em", marginBottom:6 }}>
                        <Icon name="spark" size={13} fill/> Suggested rewrite
                      </div>
                      <div style={{ fontSize:13.5, color:"var(--text)", lineHeight:1.5,
                        fontFamily:"var(--font-serif)" }}>{an.suggestion}</div>
                    </div>
                    {an.good && (
                      <div style={{ fontSize:12.5, color:"var(--text-2)", lineHeight:1.5, marginTop:9,
                        display:"flex", gap:7 }}>
                        <Icon name="book" size={14} style={{ color:"var(--ok)", flex:"0 0 auto", marginTop:2 }}/>
                        <span>{an.good}</span>
                      </div>
                    )}
                    <div style={{ display:"flex", gap:8, marginTop:11 }}>
                      <button className="btn btn-primary btn-sm" onClick={(e)=>{e.stopPropagation();
                        setApplied(a=>({...a,[an.id]:true})); setResolved(r=>({...r,[an.id]:true}));}}>
                        <Icon name="check" size={14} strokeWidth={2.3}/> {applied[an.id]?"Applied":"Apply fix"}
                      </button>
                      <button className="btn btn-sm" onClick={(e)=>{e.stopPropagation();
                        setResolved(r=>({...r,[an.id]:!r[an.id]}));}}>
                        {isDone? "Reopen":"Dismiss"}
                      </button>
                      {(an.cat==="novelty"||an.cat==="citation") && (
                        <button className="btn btn-sm btn-ghost" style={{ marginLeft:"auto" }}
                          onClick={(e)=>{e.stopPropagation(); goTo(an.cat==="novelty"?"novelty":"novelty");}}>
                          Details <Icon name="arrowR" size={14}/>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* numbered marker badge */
function Marker({ n, sev, resolved, inline, style }) {
  const S = window.DATA.SEVERITY[sev];
  return (
    <span style={{ display:"inline-grid", placeItems:"center",
      width: inline?15:21, height: inline?15:21, borderRadius:99,
      fontSize: inline?9:11, fontWeight:700, flex:"0 0 auto",
      background: resolved? "var(--surface-3)" : S.color,
      color: resolved? "var(--text-3)" : "#fff",
      marginLeft: inline?3:0, verticalAlign:"middle",
      boxShadow: inline? "none":"var(--sh-sm)", ...style }}>
      {resolved ? "✓" : n}
    </span>
  );
}

/* a faux bar chart figure placeholder (simple rects only) */
function FigurePlaceholder() {
  const bars = [
    { h:62, c:"var(--text-4)" }, { h:78, c:"var(--text-4)" },
    { h:90, c:"var(--accent)" }, { h:70, c:"var(--text-4)" },
    { h:86, c:"var(--accent)" }, { h:96, c:"var(--accent)" },
  ];
  return (
    <div style={{ background:"linear-gradient(180deg,#fff,var(--surface-2))",
      border:"1px solid var(--line)", borderRadius:12, padding:"22px 26px 18px", height:184 }}>
      <div style={{ display:"flex", alignItems:"flex-end", gap:14, height:"100%" }}>
        {bars.map((b,i)=>(
          <div key={i} style={{ flex:1, height:`${b.h}%`, background:b.c, borderRadius:"5px 5px 0 0",
            opacity:0.85 }}/>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Reader });
