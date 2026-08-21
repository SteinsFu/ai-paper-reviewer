import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { useAppState } from "../state/AppState";
import { useLibrary } from "../hooks/useReview";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useSearchEntries } from "../services/searchIndex";
import { downloadMarkdown } from "../lib/exportReport";
import { api } from "../services";

export function CommandPalette({ onToggleTheme }: { onToggleTheme: () => void }) {
  const { paletteOpen, setPaletteOpen, setChatOpen, bundle, currentPaperId } = useAppState();
  // Tab containment only — cmdk owns the input autofocus and ↑↓ navigation
  const trapRef = useFocusTrap<HTMLDivElement>(paletteOpen, { autoFocus: false });
  // cross-paper note search — finds a note in any paper, not just the open one
  const noteEntries = useSearchEntries(paletteOpen);
  const { data: library } = useLibrary();
  const navigate = useNavigate();

  const currentId = (currentPaperId && library?.some((p) => p.id === currentPaperId && !p.archived))
    ? currentPaperId
    : (library?.find((p) => !p.archived)?.id ?? "p1");

  function run(action: () => void) {
    setPaletteOpen(false);
    action();
  }

  async function exportMd() {
    const b = bundle ?? await api.getReview(currentId);
    downloadMarkdown(b);
  }

  const nav: { label: string; ic: IconName; to: string }[] = [
    { label:"Dashboard", ic:"home", to:"/" },
    { label:"New review", ic:"plus", to:"/new" },
    { label:"Analytics", ic:"grid", to:"/analytics" },
    { label:"Reviewer notes", ic:"doc", to:`/paper/${currentId}/reader` },
    { label:"Visual feedback", ic:"eye", to:`/paper/${currentId}/visual` },
    { label:"Novelty & citations", ic:"compass", to:`/paper/${currentId}/novelty` },
    { label:"Review report", ic:"report", to:`/paper/${currentId}/report` },
    { label:"Compare versions", ic:"layers", to:`/paper/${currentId}/compare` },
    { label:"Where to publish", ic:"target", to:`/paper/${currentId}/publish` },
  ];

  return (
    <AnimatePresence>
      {paletteOpen && (
        <>
          <motion.div key="backdrop" className="palette-backdrop"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.15 }}
            onClick={() => setPaletteOpen(false)}/>
          <motion.div key="palette" ref={trapRef} className="palette"
            initial={{ opacity:0, scale:0.97, y:-8 }} animate={{ opacity:1, scale:1, y:0 }}
            exit={{ opacity:0, scale:0.97, y:-8 }}
            transition={{ duration:0.18, ease:[0.22,0.61,0.36,1] }}>
            <Command label="Command palette" loop>
              <Command.Input autoFocus placeholder="Search papers, notes, actions…"/>
              <Command.List>
                <Command.Empty>No results. Try “novelty” or “export”.</Command.Empty>

                <Command.Group heading="Navigate">
                  {nav.map((n) => (
                    <Command.Item key={n.to} onSelect={() => run(() => navigate(n.to))}>
                      <Icon name={n.ic} size={16}/> {n.label}
                    </Command.Item>
                  ))}
                </Command.Group>

                {library && (
                  <Command.Group heading="Papers">
                    {library.map((p) => (
                      <Command.Item key={p.id}
                        onSelect={() => run(() => navigate(p.status === "draft" ? "/new" : `/paper/${p.id}/reader`))}>
                        <Icon name="doc" size={16}/>
                        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</span>
                        <span style={{ marginLeft:"auto", fontSize:11.5, color:"var(--text-3)", flex:"0 0 auto" }}>{p.venue}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {noteEntries.length > 0 && (
                  <Command.Group heading="Notes across papers">
                    {noteEntries.map((e) => (
                      <Command.Item key={`${e.paperId}:${e.noteId}`} value={`${e.haystack} ${e.paperId}:${e.noteId}`}
                        onSelect={() => run(() => navigate(`/paper/${e.paperId}/reader?note=${e.noteId}`))}>
                        <Icon name={e.origin === "you" ? "pen" : "spark"} size={15}/>
                        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.title}</span>
                        <span style={{ marginLeft:"auto", fontSize:11.5, color:"var(--text-3)", flex:"0 0 auto",
                          maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.paperTitle}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                <Command.Group heading="Actions">
                  <Command.Item onSelect={() => run(() => setChatOpen(true))}>
                    <Icon name="spark" size={16}/> Ask the reviewer
                    <span className="kbd" style={{ marginLeft:"auto" }}>⌘J</span>
                  </Command.Item>
                  <Command.Item onSelect={() => run(onToggleTheme)}>
                    <Icon name="moon" size={16}/> Toggle dark mode
                    <span className="kbd" style={{ marginLeft:"auto" }}>⌘⇧L</span>
                  </Command.Item>
                  <Command.Item onSelect={() => run(() => { void exportMd(); })}>
                    <Icon name="download" size={16}/> Export report as Markdown
                  </Command.Item>
                  <Command.Item onSelect={() => run(() => navigate(`/paper/${currentId}/report?print=1`))}>
                    <Icon name="report" size={16}/> Print report (PDF)
                  </Command.Item>
                </Command.Group>
              </Command.List>
              <div className="palette-foot">
                <span><span className="kbd">↑↓</span> navigate</span>
                <span><span className="kbd">↵</span> select</span>
                <span><span className="kbd">esc</span> close</span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
