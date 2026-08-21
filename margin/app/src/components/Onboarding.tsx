import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { useFocusTrap } from "../hooks/useFocusTrap";

export const ONBOARDED_KEY = "margin-onboarded";

interface Step {
  ic: IconName;
  title: string;
  body: string;
  points?: { ic: IconName; label: string }[];
}

const STEPS: Step[] = [
  {
    ic: "spark",
    title: "Welcome to Margin",
    body: "Your peer-review copilot. Margin reads a manuscript the way a careful reviewer would — writing, structure, methodology, novelty and citations — and drafts an editable report. It assists your judgment; it never replaces it.",
  },
  {
    ic: "doc",
    title: "Review, then make it yours",
    body: "Every AI note lands in the reader. Apply a suggested fix, resolve what you agree with, and add your own notes by selecting text in the manuscript. Your work is saved automatically.",
    points: [
      { ic: "check", label: "Apply or dismiss each AI note" },
      { ic: "pen", label: "Select any passage to add your own note" },
      { ic: "layers", label: "Attach a revision and compare versions" },
    ],
  },
  {
    ic: "command",
    title: "Move at the speed of thought",
    body: "A few shortcuts keep everything one keystroke away.",
    points: [
      { ic: "search", label: "⌘K — search papers, notes & actions" },
      { ic: "spark", label: "⌘J — ask the reviewer copilot" },
      { ic: "sun", label: "⌘⇧L — toggle light / dark" },
    ],
  },
];

/** First-run tour, shown once after sign-in. Reuses the shared modal/dialog
    chrome + focus trap. Finishing or skipping sets the persisted flag. */
export function Onboarding({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  function finish() {
    try { localStorage.setItem(ONBOARDED_KEY, "1"); } catch { /* ignore */ }
    onClose();
  }
  function trySample() {
    finish();
    navigate("/paper/p1/reader");
  }

  return createPortal(
    <AnimatePresence>
      <motion.div className="modal-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}>
        <motion.div ref={trapRef} className="modal" role="dialog" aria-modal="true" aria-label="Welcome to Margin"
          initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          style={{ maxWidth: 480 }}>

          <div style={{ padding: "28px 28px 8px" }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, marginBottom: 18,
              background: "linear-gradient(145deg, var(--accent), var(--accent-deep))",
              display: "grid", placeItems: "center", boxShadow: "var(--sh-accent)" }}>
              <Icon name={s.ic} size={26} style={{ color: "#fff" }} fill={s.ic === "spark"} />
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={step}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}>
                <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
                  {s.title}
                </h2>
                <p style={{ fontSize: 14.5, color: "var(--text-2)", lineHeight: 1.6, margin: 0 }}>{s.body}</p>
                {s.points && (
                  <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
                    {s.points.map((p) => (
                      <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <span style={{ width: 30, height: 30, borderRadius: 9, flex: "0 0 auto",
                          background: "var(--accent-soft)", color: "var(--accent-deep)",
                          display: "grid", placeItems: "center" }}>
                          <Icon name={p.ic} size={15} />
                        </span>
                        <span style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 500 }}>{p.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* step dots + controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 28px 24px" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {STEPS.map((_, i) => (
                <span key={i} style={{ width: i === step ? 20 : 7, height: 7, borderRadius: 99,
                  background: i === step ? "var(--accent-deep)" : "var(--line-strong)",
                  transition: "all .25s" }} />
              ))}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 9 }}>
              <button className="btn" onClick={finish}>Skip</button>
              {last ? (
                <button className="btn btn-primary" onClick={trySample}>
                  <Icon name="arrowR" size={16} /> Try a sample review
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => setStep((n) => n + 1)}>
                  Next <Icon name="chevR" size={15} />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
