import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../components/Icon";
import { ScoreRing } from "../components/ScoreRing";
import { api } from "../services";
import type { PipelineStep } from "../services/types";

/* Full-screen overlay driven by the service's analyze() progress events. */
export function Analyzing({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [finishing, setFinishing] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for await (const p of api.analyze({})) {
        if (cancelled) return;
        setStep(p.step);
        setPct(p.pct);
        setSteps(p.steps);
        if (p.done) {
          setFinishing(true);
          setTimeout(() => { if (!cancelled) onDoneRef.current(); }, 750);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AnimatePresence>
      <motion.div key="analyzing"
        initial={{ opacity:0 }} animate={{ opacity:1, scale: finishing ? 0.985 : 1 }}
        exit={{ opacity:0 }}
        transition={{ duration:0.4, ease:[0.22,0.61,0.36,1] }}
        style={{ position:"absolute", inset:0, zIndex:50, display:"grid", placeItems:"center",
          background:"var(--analyzing-bg)" }}>
        <div style={{ width:480, maxWidth:"90vw", textAlign:"center" }}>
          <div style={{ width:96, height:96, margin:"0 auto 28px" }}>
            <ScoreRing value={pct} size={96} stroke={7}/>
          </div>
          <h2 style={{ fontSize:24, fontWeight:700, letterSpacing:"-0.02em", margin:"0 0 6px" }}>
            Reading your manuscript
          </h2>
          <p style={{ fontSize:14.5, color:"var(--text-2)", margin:"0 0 30px" }}>
            Attention-Guided Summarization of Long Scientific Do…
          </p>

          <div className="card" style={{ padding:"10px 8px", textAlign:"left" }}>
            {steps.map((s, i) => {
              const state = i < step ? "done" : i === step ? "active" : "idle";
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:13, padding:"9px 12px",
                  opacity: state === "idle" ? 0.4 : 1, transition:"opacity .4s ease",
                  position:"relative" }}>
                  {state === "active" && (
                    <motion.span layoutId="analyze-active-bar"
                      style={{ position:"absolute", left:2, top:8, bottom:8, width:3,
                        borderRadius:3, background:"var(--accent)" }}/>
                  )}
                  <div style={{ width:24, height:24, borderRadius:99, flex:"0 0 auto", display:"grid",
                    placeItems:"center",
                    background: state === "done" ? "var(--accent)" : state === "active" ? "var(--accent-soft)" : "var(--surface-3)",
                    color: state === "done" ? "#fff" : "var(--accent-deep)",
                    transition:"background .25s ease" }}>
                    {state === "done"
                      ? <motion.span initial={{ scale:0 }} animate={{ scale:1 }}
                          transition={{ type:"spring", stiffness:480, damping:22 }}
                          style={{ display:"grid", placeItems:"center" }}>
                          <Icon name="check" size={14} strokeWidth={2.4}/>
                        </motion.span>
                      : state === "active"
                        ? <span className="spin-dot"/>
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
      </motion.div>
    </AnimatePresence>
  );
}
