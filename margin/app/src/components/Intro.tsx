import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const LOADING = "loading...";
const WELCOME = "Welcome to Margin";

/* Boot splash: types "loading..." letter by letter, cycles the trailing
   dots for a moment, then retypes as "Welcome to Margin" and hands off
   to the app. Click or any key skips it. */
export function Intro({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"loading" | "welcome">("loading");
  const [showHint, setShowHint] = useState(false);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  // skip on any key
  useEffect(() => {
    const onKey = () => finish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // reduced motion: no typewriter, just a brief welcome
    if (reduced) {
      setPhase("welcome");
      setText(WELCOME);
      const t = setTimeout(finish, 1100);
      return () => clearTimeout(t);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const hint = setTimeout(() => setShowHint(true), 1600);
    timers.push(hint);

    // 1 — type "loading..." letter by letter
    let i = 0;
    const typeLoading = setInterval(() => {
      i++;
      setText(LOADING.slice(0, i));
      if (i < LOADING.length) return;
      clearInterval(typeLoading);

      // 2 — cycle the dots: . → .. → ... → . …
      let dots = 3, steps = 0;
      const cycle = setInterval(() => {
        dots = (dots % 3) + 1;
        steps++;
        setText("loading" + ".".repeat(dots));
        if (steps < 8) return;
        clearInterval(cycle);

        // 3 — transform into the welcome line
        setPhase("welcome");
        setText("");
        let w = 0;
        const typeWelcome = setInterval(() => {
          w++;
          setText(WELCOME.slice(0, w));
          if (w < WELCOME.length) return;
          clearInterval(typeWelcome);
          timers.push(setTimeout(finish, 1600));
        }, 62);
        timers.push(typeWelcome);
      }, 380);
      timers.push(cycle);
    }, 88);
    timers.push(typeLoading);

    return () => timers.forEach((t) => { clearTimeout(t); clearInterval(t as ReturnType<typeof setInterval>); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <motion.div onClick={finish}
      exit={{ opacity: 0, scale: 1.015 }}
      transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
      style={{ position:"fixed", inset:0, zIndex:200, cursor:"pointer",
        background:"var(--app-glow)", backgroundColor:"var(--bg)",
        display:"grid", placeItems:"center" }}>

      <div style={{ textAlign:"center", padding:"0 24px" }}>
        {/* brand mark joins for the welcome */}
        <motion.div
          initial={false}
          animate={phase === "welcome"
            ? { opacity:1, scale:1, y:0 }
            : { opacity:0, scale:0.6, y:8 }}
          transition={{ type:"spring", stiffness:380, damping:26 }}
          style={{ display:"grid", placeItems:"center", marginBottom:26 }}>
          <div className="brand-mark" style={{ width:58, height:58, borderRadius:17 }}/>
        </motion.div>

        <div style={{ minHeight:64, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {phase === "loading" ? (
            <span style={{ fontFamily:"var(--mono)", fontSize:26, fontWeight:500,
              color:"var(--text-2)", letterSpacing:"0.01em" }}>
              {text}<span className="intro-caret" style={{ height:26 }}/>
            </span>
          ) : (
            <span style={{ fontSize:"clamp(34px, 5vw, 52px)", fontWeight:700,
              letterSpacing:"-0.035em", color:"var(--text)", lineHeight:1.1 }}>
              {text.startsWith("Welcome to ") ? (
                <>Welcome to <span style={{ color:"var(--accent-deep)" }}>{text.slice(11)}</span></>
              ) : text}
              <span className="intro-caret" style={{ height:"0.9em" }}/>
            </span>
          )}
        </div>

        <motion.div
          initial={{ opacity:0 }} animate={{ opacity: showHint ? 1 : 0 }}
          transition={{ duration:0.6 }}
          style={{ position:"fixed", bottom:34, left:0, right:0, textAlign:"center",
            fontSize:12.5, color:"var(--text-4)", fontWeight:500 }}>
          click anywhere to skip
        </motion.div>
      </div>
    </motion.div>
  );
}
