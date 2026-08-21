import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "./Icon";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { CATEGORIES, CAT_ORDER, SEVERITY } from "../data/mock";
import type { Annotation, CategoryId, SeverityId, TextAnchor } from "../services/types";

const SEV_ORDER: SeverityId[] = ["critical", "moderate", "minor"];

export interface NoteDraft {
  /** the manuscript anchor + section this note is pinned to */
  anchor: TextAnchor;
  section: string;
  /** when editing an existing user note, its current values */
  editing?: Annotation;
}

/** Modal composer for a human-authored reviewer note. Reuses the shared
    .modal / .field / .input / .seg atoms and the focus trap. */
export function NoteComposer({ draft, onSave, onClose }: {
  draft: NoteDraft;
  onSave: (fields: { cat: CategoryId; sev: SeverityId; title: string; comment: string }) => void;
  onClose: () => void;
}) {
  const editing = draft.editing;
  const [cat, setCat] = useState<CategoryId>(editing?.cat ?? "writing");
  const [sev, setSev] = useState<SeverityId>(editing?.sev ?? "moderate");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [comment, setComment] = useState(editing?.comment ?? "");
  const [err, setErr] = useState("");
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setErr("Give the note a short title."); return; }
    onSave({ cat, sev, title: title.trim(), comment: comment.trim() });
  }

  return createPortal(
    <AnimatePresence>
      <motion.div className="modal-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }} onMouseDown={onClose}>
        <motion.div ref={trapRef} className="modal" role="dialog" aria-modal="true"
          aria-label={editing ? "Edit note" : "Add note"}
          initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          style={{ maxWidth: 460 }}
          onMouseDown={(e) => e.stopPropagation()}>

          <div className="modal-head">
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 3px" }}>
                {editing ? "Edit your note" : "Add your note"}
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>{draft.section}</p>
            </div>
            <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </div>

          <form className="modal-body" onSubmit={submit}>
            {draft.anchor.quote && (
              <div style={{ fontSize: 13, color: "var(--text-2)", fontStyle: "italic",
                paddingLeft: 11, borderLeft: "2px solid var(--accent)", lineHeight: 1.5,
                marginBottom: 16, maxHeight: 88, overflow: "hidden" }}>
                "{draft.anchor.quote}"
              </div>
            )}

            <div className="field">
              <label>Category</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {CAT_ORDER.map((id) => {
                  const C = CATEGORIES[id]; const on = cat === id;
                  return (
                    <button type="button" key={id} onClick={() => setCat(id)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px",
                        borderRadius: 99, cursor: "pointer",
                        border: `1px solid ${on ? C.color : "var(--line)"}`,
                        background: on ? C.soft : "var(--surface)",
                        color: on ? C.color : "var(--text-2)", fontSize: 12.5, fontWeight: 600,
                        transition: "all .15s" }}>
                      <span className="dot" style={{ background: C.color, width: 7, height: 7 }} />
                      {C.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field">
              <label>Severity</label>
              <div className="seg" style={{ width: "100%" }}>
                {SEV_ORDER.map((id) => (
                  <button type="button" key={id} className={sev === id ? "on" : ""}
                    onClick={() => setSev(id)} style={{ flex: 1 }}>
                    {SEVERITY[id].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Title</label>
              <input className={"input" + (err ? " err" : "")} value={title}
                placeholder="e.g. Claim needs a citation"
                onChange={(e) => { setTitle(e.target.value); if (err) setErr(""); }} />
              {err && <div className="field-err">{err}</div>}
            </div>

            <div className="field">
              <label>Comment</label>
              <textarea className="input" value={comment} rows={4}
                placeholder="What should the authors change, and why?"
                style={{ resize: "vertical", minHeight: 84, lineHeight: 1.5 }}
                onChange={(e) => setComment(e.target.value)} />
            </div>

            <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 4 }}>
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                <Icon name="check" size={15} strokeWidth={2.3} /> {editing ? "Save note" : "Add note"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
