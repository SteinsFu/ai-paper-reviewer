import { useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../components/Icon";
import type { IconName } from "../components/Icon";
import { ScoreRing } from "../components/ScoreRing";
import { Segmented } from "../components/Segmented";
import { usePaperBundle } from "./PaperLayout";

type Tab = "novelty" | "related" | "refs";

export function Novelty() {
  const { bundle } = usePaperBundle();
  const { novelty, related, missingRefs, paper } = bundle;
  const [tab, setTab] = useState<Tab>("novelty");
  const [added, setAdded] = useState<Record<number, boolean>>({});

  const flagMap = {
    overlap:  { label:"High overlap", color:"var(--critical)", bg:"var(--critical-soft)" },
    related:  { label:"Related",      color:"var(--info)",     bg:"var(--info-soft)" },
    baseline: { label:"Baseline",     color:"var(--text-2)",   bg:"var(--surface-3)" },
  };

  return (
    <div className="screen-scroll scroll anim-in">
      <div style={{ maxWidth:1040, margin:"0 auto", padding:"30px 38px 70px" }}>
        <header style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:22, gap:20 }}>
          <div>
            <h1 style={{ fontSize:28, fontWeight:700, letterSpacing:"-0.03em", margin:"0 0 6px" }}>
              Novelty &amp; citations
            </h1>
            <p style={{ fontSize:15.5, color:"var(--text-2)", margin:0, maxWidth:560 }}>
              Margin retrieved {paper.refs} references and cross-checked the manuscript against 2.1M papers
              to find overlaps, gaps, and missing work.
            </p>
          </div>
          <Segmented id="novelty-tabs" value={tab} onChange={setTab} options={[
            { value:"novelty", label:"Novelty" },
            { value:"related", label:"Related work" },
            { value:"refs", label:"Citations" },
          ]}/>
        </header>

        {tab === "novelty" && (
          <div className="anim-in" style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:20 }}>
            <div className="card" style={{ padding:"26px 24px", textAlign:"center", height:"fit-content" }}>
              <ScoreRing value={novelty.score} size={132} stroke={11} sub="NOVELTY"/>
              <div style={{ fontSize:15, fontWeight:600, margin:"18px 0 6px", letterSpacing:"-0.01em" }}>
                {novelty.verdict}
              </div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12.5,
                color:"var(--text-2)", background:"var(--surface-3)", padding:"5px 12px", borderRadius:99 }}>
                <Icon name="layers" size={14}/> compared against 2.1M papers
              </div>
            </div>

            <div>
              <div className="card" style={{ padding:"20px 22px", marginBottom:16 }}>
                <h3 style={{ fontSize:15, fontWeight:700, margin:"0 0 9px" }}>Assessment</h3>
                <p style={{ fontSize:14.5, color:"var(--text-2)", lineHeight:1.6, margin:0 }}>{novelty.summary}</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <ListCard title="Genuinely novel" ic="checkCircle" color="var(--ok)" items={novelty.strengths}/>
                <ListCard title="Novelty risks" ic="alert" color="var(--critical)" items={novelty.risks}/>
              </div>
            </div>
          </div>
        )}

        {tab === "related" && (
          <div className="anim-in" style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {related.map((r, i) => {
              const f = flagMap[r.flag];
              return (
                <motion.div key={i} className="card"
                  initial={{ opacity:0, y:12 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}
                  transition={{ delay: i * 0.05, type:"spring", stiffness:380, damping:32 }}
                  style={{ padding:"18px 20px", display:"flex", gap:18, alignItems:"center" }}>
                  <div style={{ width:64, textAlign:"center", flex:"0 0 auto" }}>
                    {r.flag === "overlap" ? (
                      <ScoreRing value={r.sim} size={58} stroke={6} color="var(--critical)" sub="SIMILAR"/>
                    ) : (
                      <>
                        <div className="num" style={{ fontSize:26, fontWeight:700, letterSpacing:"-0.03em",
                          color: r.sim >= 65 ? "var(--critical)" : r.sim >= 45 ? "var(--accent-deep)" : "var(--text-2)" }}>{r.sim}%</div>
                        <div style={{ fontSize:10, color:"var(--text-3)", fontWeight:600, textTransform:"uppercase",
                          letterSpacing:"0.03em" }}>similar</div>
                      </>
                    )}
                  </div>
                  <div style={{ width:1, alignSelf:"stretch", background:"var(--line-2)" }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:15, fontWeight:600, letterSpacing:"-0.01em" }}>{r.title}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:f.color, background:f.bg,
                        padding:"2px 9px", borderRadius:99 }}>{f.label}</span>
                    </div>
                    <div style={{ fontSize:12.5, color:"var(--text-3)", marginBottom:7 }}>{r.authors} · {r.venue}</div>
                    <div style={{ fontSize:13.5, color:"var(--text-2)", lineHeight:1.5 }}>{r.note}</div>
                  </div>
                  <button className="btn btn-sm" style={{ flex:"0 0 auto" }}>
                    <Icon name="link" size={14}/> View
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        {tab === "refs" && (
          <div className="anim-in">
            <div style={{ display:"flex", gap:14, marginBottom:18 }}>
              <RefStat value={paper.refs} label="References" tone="ok"/>
              <RefStat value={missingRefs.length} label="Suggested additions" tone="warn"/>
              <RefStat value={2} label="Possibly outdated" tone="info"/>
              <RefStat value={0} label="Broken / unresolved" tone="ok"/>
            </div>
            <h3 style={{ fontSize:15, fontWeight:700, margin:"0 0 12px", display:"flex", alignItems:"center", gap:8 }}>
              <Icon name="plus" size={16} style={{ color:"var(--accent-deep)" }} strokeWidth={2.2}/>
              Suggested references to add
            </h3>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {missingRefs.map((m, i) => (
                <div key={i} className="card" style={{ padding:"15px 18px", display:"flex", gap:14, alignItems:"flex-start" }}>
                  <span style={{ width:30, height:30, borderRadius:8, flex:"0 0 auto", display:"grid",
                    placeItems:"center", background:"var(--accent-soft)", color:"var(--accent-deep)" }}>
                    <Icon name="book" size={16}/></span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, fontFamily:"var(--font-serif)", marginBottom:4 }}>{m.text}</div>
                    <div style={{ fontSize:12.5, color:"var(--text-2)", lineHeight:1.45 }}>{m.reason}</div>
                  </div>
                  <button className={"btn btn-sm" + (added[i] ? "" : " btn-ghost")} style={{ flex:"0 0 auto",
                      color: added[i] ? "var(--ok)" : undefined }}
                    onClick={() => setAdded((a) => ({ ...a, [i]: true }))}>
                    <Icon name={added[i] ? "check" : "plus"} size={14} strokeWidth={2.2}/>
                    {added[i] ? "Added" : "Add"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ListCard({ title, ic, color, items }: { title: string; ic: IconName; color: string; items: string[] }) {
  return (
    <div className="card" style={{ padding:"18px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <Icon name={ic} size={17} style={{ color }}/>
        <h3 style={{ fontSize:14.5, fontWeight:700, margin:0 }}>{title}</h3>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {items.map((it, i) => (
          <motion.div key={i} initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
            style={{ display:"flex", gap:9, fontSize:13.5, color:"var(--text-2)", lineHeight:1.5 }}>
            <span style={{ width:5, height:5, borderRadius:99, background:color, flex:"0 0 auto", marginTop:7 }}/>
            <span>{it}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function RefStat({ value, label, tone }: { value: number; label: string; tone: "ok" | "warn" | "info" }) {
  const c = { ok:"var(--ok)", warn:"var(--accent-deep)", info:"var(--info)" }[tone];
  return (
    <div className="card" style={{ padding:"16px 18px", flex:1 }}>
      <div className="num" style={{ fontSize:30, fontWeight:700, letterSpacing:"-0.03em", color:c }}>{value}</div>
      <div style={{ fontSize:12.5, color:"var(--text-2)", fontWeight:500, marginTop:2 }}>{label}</div>
    </div>
  );
}
