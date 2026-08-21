import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../components/Icon";
import { ScoreRing } from "../components/ScoreRing";
import { ScoreBar } from "../components/ScoreBar";
import { CatTag, Marker, SevPill } from "../components/Tags";
import { NoteComposer } from "../components/NoteComposer";
import type { NoteDraft } from "../components/NoteComposer";
import { FigurePlot } from "../components/FigurePlot";
import { Segmented } from "../components/Segmented";
import { usePaperBundle } from "./PaperLayout";
import { useReviewState } from "../hooks/useReview";
import { CATEGORIES, CAT_ORDER, SEVERITY } from "../data/mock";
import type { Annotation, CategoryId, ManuscriptBlock, Reference, SeverityId } from "../services/types";

type ReaderView = "reading" | "paper";
const VIEW_KEY = "margin-reader-view";

/** where the floating "Add note" affordance sits + the anchor it will create */
interface PendingSelection {
  blockIndex: number; start: number; end: number; quote: string; section: string;
  x: number; y: number;
}

let userNoteSeq = 0;
const nextNoteId = () => `u${Date.now().toString(36)}${(userNoteSeq++).toString(36)}`;

export function Reader() {
  const { bundle, paperId } = usePaperBundle();
  const { manuscript, annotations, paper, scores, references } = bundle;
  const {
    resolved, applied, userNotes,
    toggleResolved, applyFix, addNote, updateNote, deleteNote,
  } = useReviewState(paperId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selected, setSelected] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<CategoryId | "all">("all");
  const [view, setViewState] = useState<ReaderView>(() => {
    try { return localStorage.getItem(VIEW_KEY) === "paper" ? "paper" : "reading"; } catch { return "reading"; }
  });
  const setView = useCallback((v: ReaderView) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  }, []);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [composer, setComposer] = useState<NoteDraft | null>(null);
  const [flashBlock, setFlashBlock] = useState<number | null>(null);
  const [railOpen, setRailOpen] = useState(false); // narrow-viewport rail drawer

  const docRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const spanRefs = useRef<Record<string, HTMLElement | null>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // AI notes and the reviewer's own notes share one list for the rail, counts,
  // marker numbers and filtering — Annotation covers both (origin distinguishes them).
  const allNotes = useMemo<Annotation[]>(() => [...annotations, ...userNotes], [annotations, userNotes]);
  const annoById = useMemo(() => Object.fromEntries(allNotes.map((a) => [a.id, a])), [allNotes]);
  const markerIndex = useMemo(() => {
    const m: Record<string, number> = {};
    allNotes.forEach((a, i) => { m[a.id] = i + 1; });
    return m;
  }, [allNotes]);

  const visible = allNotes.filter((a) => catFilter === "all" || a.cat === catFilter);
  const total = allNotes.length;
  const resolvedCount = allNotes.filter((a) => resolved[a.id]).length;
  const openCount = total - resolvedCount;

  const registerSpanRef = useCallback((id: string, el: HTMLElement | null) => {
    spanRefs.current[id] = el;
  }, []);

  function scrollToSpan(id: string) {
    const cont = docRef.current;
    if (!cont) return;
    // AI notes have an inline <mark> span; user notes anchor to a whole block
    const an = annoById[id];
    const el = spanRefs.current[id]
      ?? (an?.anchor ? cont.querySelector<HTMLElement>(`[data-block="${an.anchor.blockIndex}"]`) : null);
    if (!el) return;
    cont.scrollTo({ top: el.offsetTop - cont.clientHeight * 0.34, behavior:"smooth" });
    if (an?.origin === "you" && an.anchor) {
      setFlashBlock(an.anchor.blockIndex);
      window.setTimeout(() => setFlashBlock(null), 1300);
    }
  }
  function scrollToCard(id: string) {
    const el = cardRefs.current[id]; const cont = railRef.current;
    if (!el || !cont) return;
    cont.scrollTo({ top: el.offsetTop - 14, behavior:"smooth" });
  }
  function selectAnno(id: string, from?: "doc" | "rail") {
    setSelected(id);
    if (from !== "doc") scrollToSpan(id);
    if (from !== "rail") scrollToCard(id);
  }

  // ----- text selection → "Add note" affordance -----------------------------
  const onDocMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const cont = docRef.current;
    if (!sel || sel.isCollapsed || !cont) { setPending(null); return; }
    const quote = sel.toString().trim();
    if (quote.length < 3) { setPending(null); return; }
    const range = sel.getRangeAt(0);
    const startNode = range.startContainer;
    const host = (startNode.nodeType === 3 ? startNode.parentElement : startNode as HTMLElement);
    const blockEl = host?.closest<HTMLElement>("[data-block]");
    if (!blockEl || !cont.contains(blockEl)) { setPending(null); return; }
    const blockIndex = Number(blockEl.getAttribute("data-block"));
    // char offset of the selection start within the block's text
    const pre = document.createRange();
    pre.selectNodeContents(blockEl);
    try { pre.setEnd(range.startContainer, range.startOffset); } catch { setPending(null); return; }
    const start = pre.toString().length;
    const end = start + sel.toString().length;
    const rect = range.getBoundingClientRect();
    const section = (manuscript[blockIndex] as { section?: string })?.section ?? paper.title;
    setPending({ blockIndex, start, end, quote, section, x: rect.left + rect.width / 2, y: rect.top });
  }, [manuscript, paper.title]);

  // dismiss the affordance when the selection is cleared elsewhere
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.(".add-note-fab")) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) setPending(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function openComposerFromSelection() {
    if (!pending) return;
    setComposer({
      anchor: { blockIndex: pending.blockIndex, start: pending.start, end: pending.end, quote: pending.quote },
      section: pending.section,
    });
    setPending(null);
    window.getSelection()?.removeAllRanges();
  }

  function saveNote(fields: { cat: CategoryId; sev: SeverityId; title: string; comment: string }) {
    if (!composer) return;
    if (composer.editing) {
      updateNote(composer.editing.id, { ...fields });
    } else {
      const now = Date.now();
      addNote({
        id: nextNoteId(),
        cat: fields.cat, sev: fields.sev, section: composer.section,
        title: fields.title, excerpt: composer.anchor.quote, comment: fields.comment,
        origin: "you", author: "You", createdAt: now, updatedAt: now, anchor: composer.anchor,
      });
    }
    setComposer(null);
  }

  function editNote(an: Annotation) {
    if (!an.anchor) return;
    setComposer({ anchor: an.anchor, section: an.section, editing: an });
  }

  // deep link from the command palette: /paper/:id/reader?note=a3
  const noteParam = searchParams.get("note");
  useEffect(() => {
    if (!noteParam || !annoById[noteParam]) return;
    const t = setTimeout(() => {
      selectAnno(noteParam);
      setSearchParams({}, { replace: true });
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteParam]);

  const sevOrder: Record<string, number> = { critical:0, moderate:1, minor:2 };
  const sortedVisible = [...visible].sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev]);

  // one manuscript block → JSX. Shared by Reading and Paper views so annotations,
  // apply-fix, and inline user-note highlights behave identically in both.
  function renderBlock(blk: ManuscriptBlock, bi: number) {
    if (blk.type === "h1")
      return <h2 key={bi} style={{ fontSize:20, fontWeight:700, letterSpacing:"-0.02em",
        margin: bi ? "30px 0 12px" : "0 0 12px", color:"var(--text)", breakInside:"avoid" }}>{blk.runs[0].t}</h2>;
    if (blk.type === "fig") {
      const an = annoById[blk.anno];
      const isSel = selected === blk.anno;
      const spanCols = view === "paper" && blk.span;
      return (
        <figure key={bi} style={{ margin:"18px 0", breakInside:"avoid",
          columnSpan: spanCols ? "all" : undefined }}>
          <div onClick={an ? () => selectAnno(blk.anno, "doc") : undefined}
            style={{ cursor: an ? "pointer" : "default", borderRadius:12, position:"relative",
              outline: isSel && an ? "2px solid var(--warn)" : "2px solid transparent",
              outlineOffset:3, transition:"outline .15s" }}>
            {blk.plot ? <FigurePlot spec={blk.plot}/> : <FigurePlaceholder/>}
            {an && (
              <Marker n={markerIndex[blk.anno]} sev={an.sev} resolved={resolved[an.id]}
                style={{ position:"absolute", top:10, right:10 }}/>
            )}
          </div>
          <figcaption style={{ fontSize:12.5, color:"var(--text-3)", marginTop:8, fontStyle:"italic",
            textAlign:"center" }}>{blk.caption}</figcaption>
        </figure>
      );
    }
    // paragraph
    const flashing = flashBlock === bi;
    const fullText = blk.runs.map((rn) => rn.t).join("");
    const uRanges = userRangesForBlock(bi, fullText, userNotes);
    let off = 0;
    return (
      <p key={bi} data-block={bi}
        style={{ fontFamily:"var(--font-serif)", fontSize: view === "paper" ? 14 : 17.5,
        lineHeight: view === "paper" ? 1.55 : 1.72,
        margin:"0 0 13px", color:"var(--doc-ink)", letterSpacing:0, textWrap:"pretty",
        textAlign: view === "paper" ? "justify" : "left",
        borderRadius:6, transition:"background .3s, box-shadow .3s",
        background: flashing ? "var(--accent-soft)" : "transparent",
        boxShadow: flashing ? "0 0 0 6px var(--accent-soft)" : "none" }}>
        {blk.runs.map((r, ri) => {
          const runStart = off; off += r.t.length;
          // plain text — overlay the reviewer's own-note highlights
          if (!r.a) return (
            <PlainRun key={ri} text={r.t} runStart={runStart} ranges={uRanges}
              selected={selected} resolved={resolved}
              markerIndex={markerIndex} registerRef={registerSpanRef}
              onSelect={(id) => selectAnno(id, "doc")}/>
          );
          const an = annoById[r.a];
          const S = SEVERITY[an.sev];
          const isSel = selected === r.a;
          const isDone = resolved[r.a];
          const isFixed = applied[r.a] && an.rewrite;
          return (
            <mark key={ri}
              ref={(el) => { spanRefs.current[r.a!] = el; }}
              onClick={() => selectAnno(r.a!, "doc")}
              className={isSel ? "mark-pulse" : undefined}
              style={{
                ["--flash-color" as string]: S.soft,
                background: isDone || !isSel ? "transparent" : S.soft,
                color:"inherit", cursor:"pointer", borderRadius:4,
                padding:"1px 2px", margin:"0 -2px",
                textDecorationLine: isDone ? "none" : "underline",
                textDecorationColor: isDone ? "transparent" : S.color,
                textDecorationThickness:"2px", textUnderlineOffset:"3px",
                textDecorationStyle:"wavy",
                opacity: isDone && !isFixed ? 0.55 : 1,
                transition:"background .15s, opacity .2s",
              }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={isFixed ? "fixed" : "orig"}
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  transition={{ duration:0.28 }}
                  style={isFixed ? { background:"var(--ok-soft)", borderRadius:4,
                    padding:"1px 2px" } : undefined}>
                  {isFixed ? an.rewrite : r.t}
                </motion.span>
              </AnimatePresence>
              <sup><Marker n={markerIndex[r.a]} sev={an.sev} resolved={isDone} inline/></sup>
            </mark>
          );
        })}
      </p>
    );
  }

  const statLine = (
    <div className="num" style={{ textAlign:"center", color:"var(--text-4)", fontSize:12.5, marginTop:26 }}>
      ··· {paper.pages} pages · {paper.words.toLocaleString()} words · {paper.refs} references ···
    </div>
  );

  return (
    <div style={{ display:"flex", height:"100%", minHeight:0 }} className="anim-in">

      {/* ============ Manuscript column ============ */}
      <div style={{ flex:"1 1 auto", minWidth:0, display:"flex", flexDirection:"column" }}>

        {/* paper header */}
        <div style={{ padding:"20px 40px 16px", borderBottom:"1px solid var(--line-2)",
          background:"var(--grad-card)" }}>
          <div style={{ display:"flex", gap:22, alignItems:"flex-start" }}>
            <ScoreRing value={paper.overall} size={62} stroke={6} sub="HEALTH"/>
            <div style={{ flex:1, minWidth:0 }}>
              <h1 style={{ fontSize:20, fontWeight:700, letterSpacing:"-0.02em", margin:"0 0 4px",
                lineHeight:1.25 }}>{paper.title}</h1>
              <div style={{ fontSize:13, color:"var(--text-2)" }}>
                {paper.authors} · {paper.venue}
              </div>
              <div style={{ display:"flex", gap:7, marginTop:12, flexWrap:"wrap" }}>
                {CAT_ORDER.map((id) => {
                  const C = CATEGORIES[id]; const sc = scores[id];
                  const on = catFilter === id;
                  return (
                    <button key={id} onClick={() => setCatFilter(on ? "all" : id)}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px 4px 8px",
                        borderRadius:99, border:`1px solid ${on ? C.color : "var(--line)"}`,
                        background: on ? C.soft : "var(--surface)", cursor:"pointer",
                        transition:"all .15s" }}>
                      <span className="dot" style={{ background:C.color, width:7, height:7 }}/>
                      <span style={{ fontSize:12, fontWeight:600, color: on ? C.color : "var(--text-2)" }}>{C.label}</span>
                      <span className="num" style={{ fontSize:12, fontWeight:700,
                        color: sc >= 85 ? "var(--ok)" : sc >= 70 ? "var(--text)" : "var(--critical)" }}>{sc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ flex:"0 0 auto" }}>
              <Segmented id="reader-view" value={view} onChange={setView} options={[
                { value:"reading", label:"Reading" },
                { value:"paper", label:"Paper" },
              ]}/>
            </div>
          </div>
        </div>

        {/* the document */}
        <div ref={docRef} className="scroll" onMouseUp={onDocMouseUp}
          style={{ flex:1, minHeight:0, padding: view === "paper" ? "32px 0 120px" : "40px 0 120px" }}>
          {view === "paper" ? (
            <div className="paper-sheet">
              <div className="paper-masthead paper-span">
                <h1 style={{ fontFamily:"var(--font-serif)", fontSize:23, fontWeight:700,
                  letterSpacing:"-0.01em", lineHeight:1.25, margin:"0 0 10px" }}>{paper.title}</h1>
                <div style={{ fontSize:13.5, color:"var(--text-2)", marginBottom:2 }}>{paper.authors}</div>
                <div style={{ fontSize:12, color:"var(--text-3)", fontStyle:"italic" }}>{paper.venue}</div>
              </div>
              {/* abstract spans both columns; the body flows in two columns */}
              <div className="paper-span" style={{ margin:"4px 0 6px" }}>
                {manuscript.map((blk, bi) => blk.section === "Abstract" ? renderBlock(blk, bi) : null)}
              </div>
              <div className="paper-col">
                {manuscript.map((blk, bi) => blk.section === "Abstract" ? null : renderBlock(blk, bi))}
              </div>
              <References refs={references} span/>
              {statLine}
            </div>
          ) : (
            <div style={{ maxWidth:720, margin:"0 auto", padding:"0 44px" }}>
              {manuscript.map((blk, bi) => renderBlock(blk, bi))}
              <References refs={references}/>
              {statLine}
            </div>
          )}
        </div>
      </div>

      {/* ============ Annotation rail ============ */}
      <div className={"reader-rail" + (railOpen ? " open" : "")}
        style={{ borderLeft:"1px solid var(--line-2)",
        display:"flex", flexDirection:"column", background:"var(--surface-2)" }}>
        <div style={{ padding:"16px 18px 13px", borderBottom:"1px solid var(--line-2)",
          background:"var(--frost-rail)", backdropFilter:"blur(12px)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <h2 style={{ fontSize:16, fontWeight:700, margin:0, letterSpacing:"-0.02em" }}>Reviewer notes</h2>
              <span className="chip num" style={{ height:21, fontSize:11.5, background:"var(--accent-soft)",
                color:"var(--accent-press)" }}>{openCount} open</span>
            </div>
            <button className="btn btn-sm" onClick={() => navigate(`/paper/${paperId}/report`)}>
              <Icon name="report" size={15}/> Report
            </button>
          </div>
          {/* progress strip */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:11 }}>
            <ScoreBar value={(resolvedCount / total) * 100} color="var(--ok)"/>
            <span className="num" style={{ fontSize:11.5, fontWeight:600, color:"var(--text-3)",
              whiteSpace:"nowrap" }}>{resolvedCount} of {total} resolved</span>
          </div>
          {catFilter !== "all" && (
            <button onClick={() => setCatFilter("all")} style={{ marginTop:10, border:"none",
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
          {sortedVisible.map((an) => (
            <NoteCard key={an.id} an={an}
              refCb={(el) => { cardRefs.current[an.id] = el; }}
              n={markerIndex[an.id]}
              isSel={selected === an.id}
              isDone={!!resolved[an.id]}
              isApplied={!!applied[an.id]}
              onSelect={() => selectAnno(an.id, "rail")}
              onApply={() => applyFix(an.id)}
              onToggle={() => toggleResolved(an.id)}
              onDetails={() => navigate(`/paper/${paperId}/novelty`)}
              onEdit={() => editNote(an)}
              onDelete={() => { deleteNote(an.id); if (selected === an.id) setSelected(null); }}
            />
          ))}
        </div>
      </div>

      {/* rail toggle — only visible on narrow viewports (CSS) */}
      <button className="reader-rail-toggle btn btn-primary" onClick={() => setRailOpen((o) => !o)}>
        <Icon name={railOpen ? "close" : "report"} size={16}/>
        {railOpen ? "Close" : `Notes${openCount ? ` · ${openCount}` : ""}`}
      </button>

      {/* floating "Add note" affordance shown over a fresh text selection */}
      <AnimatePresence>
        {pending && (
          <motion.button className="add-note-fab btn btn-primary btn-sm"
            initial={{ opacity:0, y:6, scale:0.9 }} animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:6, scale:0.9 }}
            transition={{ type:"spring", stiffness:520, damping:30 }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={openComposerFromSelection}
            style={{ position:"fixed", left: pending.x, top: pending.y - 46,
              transform:"translateX(-50%)", zIndex:60, boxShadow:"var(--sh-lg)", whiteSpace:"nowrap" }}>
            <Icon name="pen" size={14}/> Add note
          </motion.button>
        )}
      </AnimatePresence>

      {composer && (
        <NoteComposer draft={composer} onSave={saveNote} onClose={() => setComposer(null)}/>
      )}
    </div>
  );
}

function NoteCard({ an, n, isSel, isDone, isApplied, onSelect, onApply, onToggle, onDetails, onEdit, onDelete, refCb }: {
  an: Annotation; n: number; isSel: boolean; isDone: boolean; isApplied: boolean;
  onSelect: () => void; onApply: () => void; onToggle: () => void; onDetails: () => void;
  onEdit: () => void; onDelete: () => void;
  refCb: (el: HTMLDivElement | null) => void;
}) {
  const C = CATEGORIES[an.cat]; const S = SEVERITY[an.sev];
  const mine = an.origin === "you";
  return (
    <div ref={refCb} onClick={onSelect}
      style={{ background:"var(--surface)", border:`1px solid ${isSel ? C.color : "var(--line-2)"}`,
        borderRadius:14, padding:"13px 14px", marginBottom:9, cursor:"pointer",
        boxShadow: isSel ? "var(--sh)" : "var(--sh-sm)", transition:"all .15s",
        opacity: isDone ? 0.62 : 1 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <Marker n={n} sev={an.sev} resolved={isDone}/>
        <CatTag cat={an.cat} small/>
        <span className="chip" style={{ height:19, fontSize:10.5, fontWeight:700, letterSpacing:"0.02em",
          textTransform:"uppercase", padding:"0 7px",
          background: mine ? "var(--accent-soft)" : "var(--surface-3)",
          color: mine ? "var(--accent-press)" : "var(--text-3)" }}>
          {mine ? "You" : "AI"}
        </span>
        <span style={{ marginLeft:"auto" }}><SevPill sev={an.sev}/></span>
      </div>
      <div style={{ fontSize:14.5, fontWeight:600, marginBottom:6, letterSpacing:"-0.01em",
        textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--text-2)" : "var(--text)" }}>
        {an.title}
      </div>
      <div style={{ fontSize:12.5, color:"var(--text-3)", fontStyle:"italic", marginBottom:9,
        paddingLeft:10, borderLeft:`2px solid ${S.color}`, lineHeight:1.45 }}>
        "{an.excerpt}"
      </div>
      <div style={{ fontSize:13.5, color:"var(--text-2)", lineHeight:1.5,
        marginBottom: an.suggestion ? 10 : 0 }}>
        {an.comment}
      </div>

      <AnimatePresence initial={false}>
        {isSel && an.suggestion && (
          <motion.div key="suggestion"
            initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
            exit={{ height:0, opacity:0 }}
            transition={{ type:"spring", stiffness:380, damping:34 }}
            style={{ overflow:"hidden" }}>
            <div style={{ marginTop:4 }}>
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
                <button className="btn btn-primary btn-sm"
                  onClick={(e) => { e.stopPropagation(); onApply(); }}>
                  <Icon name="check" size={14} strokeWidth={2.3}/> {isApplied ? "Applied" : "Apply fix"}
                </button>
                <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
                  {isDone ? "Reopen" : "Dismiss"}
                </button>
                {(an.cat === "novelty" || an.cat === "citation") && (
                  <button className="btn btn-sm btn-ghost" style={{ marginLeft:"auto" }}
                    onClick={(e) => { e.stopPropagation(); onDetails(); }}>
                    Details <Icon name="arrowR" size={14}/>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* action row for the reviewer's own notes (no AI rewrite to apply) */}
      <AnimatePresence initial={false}>
        {isSel && mine && (
          <motion.div key="mine-actions"
            initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
            exit={{ height:0, opacity:0 }}
            transition={{ type:"spring", stiffness:380, damping:34 }}
            style={{ overflow:"hidden" }}>
            <div style={{ display:"flex", gap:8, marginTop:11 }}>
              <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
                {isDone ? "Reopen" : "Resolve"}
              </button>
              <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Icon name="pen" size={14}/> Edit
              </button>
              <button className="btn btn-sm btn-ghost" style={{ marginLeft:"auto", color:"var(--critical)" }}
                onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <Icon name="trash" size={14}/> Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ----- inline highlighting for the reviewer's own notes ------------------- */
interface UserRange { start: number; end: number; id: string; sev: Annotation["sev"] }

/** Locate each user note's quoted text within a block, re-found every render so
    the highlight survives an applied AI rewrite that shifts character offsets.
    If the quote no longer matches (text changed), the note still lives in the rail. */
function userRangesForBlock(bi: number, fullText: string, userNotes: Annotation[]): UserRange[] {
  const out: UserRange[] = [];
  for (const n of userNotes) {
    if (n.anchor?.blockIndex !== bi) continue;
    const q = n.anchor.quote?.trim();
    if (!q) continue;
    const idx = fullText.indexOf(q);
    if (idx < 0) continue;
    out.push({ start: idx, end: idx + q.length, id: n.id, sev: n.sev });
  }
  return out;
}

/** Render one plain run, splicing a clickable dotted-underline highlight wherever
    a user-note range falls. AI-annotated runs are rendered separately and untouched. */
function PlainRun({ text, runStart, ranges, selected, resolved, markerIndex, registerRef, onSelect }: {
  text: string; runStart: number; ranges: UserRange[];
  selected: string | null; resolved: Record<string, boolean>;
  markerIndex: Record<string, number>;
  registerRef: (id: string, el: HTMLElement | null) => void;
  onSelect: (id: string) => void;
}) {
  const runEnd = runStart + text.length;
  const pts = new Set<number>([0, text.length]);
  for (const r of ranges) {
    if (r.end <= runStart || r.start >= runEnd) continue;
    pts.add(Math.max(0, r.start - runStart));
    pts.add(Math.min(text.length, r.end - runStart));
  }
  const bounds = [...pts].sort((a, b) => a - b);
  const out: ReactNode[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const s = bounds[i], e = bounds[i + 1];
    if (s >= e) continue;
    const absS = runStart + s;
    const r = ranges.find((rr) => rr.start <= absS && rr.end > absS);
    const seg = text.slice(s, e);
    if (!r) { out.push(<span key={i}>{seg}</span>); continue; }
    const isSel = selected === r.id;
    const isDone = !!resolved[r.id];
    const isFirst = absS === r.start;      // register the scroll anchor once, at the note's true start
    const isLast = runStart + e === r.end; // marker sits at the end of the note
    out.push(
      <mark key={i}
        ref={isFirst ? (el) => registerRef(r.id, el) : undefined}
        onClick={(ev) => { ev.stopPropagation(); onSelect(r.id); }}
        className={isSel ? "mark-pulse" : undefined}
        style={{
          ["--flash-color" as string]: "var(--accent-soft)",
          background: isSel && !isDone ? "var(--accent-soft)" : "transparent",
          color: "inherit", cursor: "pointer", borderRadius: 3, padding: "1px 1px", margin: "0 -1px",
          textDecoration: isDone ? "none" : "underline",
          textDecorationColor: isDone ? "transparent" : "var(--accent-deep)",
          textDecorationStyle: "dotted", textDecorationThickness: "2px", textUnderlineOffset: "3px",
          opacity: isDone ? 0.55 : 1, transition: "background .15s, opacity .2s",
        }}>
        {seg}
        {isLast && <sup><Marker n={markerIndex[r.id]} sev={r.sev} resolved={isDone} inline/></sup>}
      </mark>,
    );
  }
  return <>{out}</>;
}

/* the paper's bibliography — numbered list, two-column in Paper view */
function References({ refs, span }: { refs?: Reference[]; span?: boolean }) {
  if (!refs || refs.length === 0) return null;
  return (
    <div className={span ? "paper-span paper-refs" : undefined}
      style={{ marginTop: span ? 20 : 34, paddingTop: 16, borderTop: "1px solid var(--line-2)" }}>
      <h2 style={{ fontSize: span ? 14 : 18, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 10px" }}>
        References
      </h2>
      <ol style={{ margin: 0, paddingLeft: 20, columnCount: span ? 2 : 1, columnGap: 28,
        fontSize: span ? 11 : 13, lineHeight: 1.5, color: "var(--text-2)" }}>
        {refs.map((r) => (
          <li key={r.id} style={{ marginBottom: 6, breakInside: "avoid", paddingLeft: 2 }}>{r.text}</li>
        ))}
      </ol>
    </div>
  );
}

/* a faux bar chart figure placeholder */
function FigurePlaceholder() {
  const bars = [
    { h:62, c:"var(--text-4)" }, { h:78, c:"var(--text-4)" },
    { h:90, c:"var(--accent)" }, { h:70, c:"var(--text-4)" },
    { h:86, c:"var(--accent)" }, { h:96, c:"var(--accent)" },
  ];
  return (
    <div style={{ background:"var(--grad-card)",
      border:"1px solid var(--line)", borderRadius:12, padding:"22px 26px 18px", height:184 }}>
      <div style={{ display:"flex", alignItems:"flex-end", gap:14, height:"100%" }}>
        {bars.map((b, i) => (
          <div key={i} style={{ flex:1, height:`${b.h}%`, background:b.c, borderRadius:"5px 5px 0 0",
            opacity:0.85 }}/>
        ))}
      </div>
    </div>
  );
}
