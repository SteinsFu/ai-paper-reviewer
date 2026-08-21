/* ============================================================
   Margin — per-paper review state store
   The reviewer's actual work product — which notes are resolved,
   which fixes were applied, any human-authored notes, and report
   edits — must survive a refresh. It lives in one observable store
   (same shape as libraryStore) persisted to localStorage, keyed by
   paper id. useReviewState subscribes via useSyncExternalStore.
   ============================================================ */
import type { Annotation, ReviewReport, PaperVersion } from "./types";

const KEY = "margin-review-state";
const SCHEMA = 2; // bump when PaperReviewState shape changes → old blobs are dropped

export interface PaperReviewState {
  resolved: Record<string, boolean>;
  applied: Record<string, boolean>;
  userNotes: Annotation[];
  reportEdits?: Partial<ReviewReport>;
  /** revisions synthesized from this paper's review state (F6) */
  versions?: PaperVersion[];
}

interface Persisted {
  schema: number;
  papers: Record<string, PaperReviewState>;
}

/** a stable empty slice — referential-stability rule for getSnapshot
    consumers that read a paper with no saved state yet */
export const EMPTY_REVIEW: PaperReviewState = Object.freeze({
  resolved: {}, applied: {}, userNotes: [],
});

function blank(): PaperReviewState {
  return { resolved: {}, applied: {}, userNotes: [] };
}

function load(): Record<string, PaperReviewState> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>;
      if (p.schema === SCHEMA && p.papers) return p.papers;
      // stale schema → discard rather than risk a shape mismatch
    }
  } catch { /* ignore malformed / unavailable storage */ }
  return {};
}

function save(papers: Record<string, PaperReviewState>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ schema: SCHEMA, papers } satisfies Persisted));
  } catch { /* ignore */ }
}

let papers = load();
const listeners = new Set<() => void>();

function commit(next: Record<string, PaperReviewState>) {
  papers = next;
  save(papers);
  listeners.forEach((l) => l());
}

/** apply a mutation to one paper's slice, returning a fresh top-level map */
function mutate(id: string, fn: (s: PaperReviewState) => PaperReviewState) {
  const cur = papers[id] ?? blank();
  commit({ ...papers, [id]: fn(cur) });
}

export const reviewStore = {
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  },
  /** the whole stable map (referential stability across renders) */
  getSnapshot(): Record<string, PaperReviewState> {
    return papers;
  },

  toggleResolved(id: string, annoId: string, value?: boolean) {
    mutate(id, (s) => ({ ...s, resolved: { ...s.resolved, [annoId]: value ?? !s.resolved[annoId] } }));
  },
  applyFix(id: string, annoId: string) {
    mutate(id, (s) => ({
      ...s,
      applied: { ...s.applied, [annoId]: true },
      resolved: { ...s.resolved, [annoId]: true },
    }));
  },
  addNote(id: string, note: Annotation) {
    mutate(id, (s) => ({ ...s, userNotes: [...s.userNotes, note] }));
  },
  updateNote(id: string, annoId: string, patch: Partial<Annotation>) {
    mutate(id, (s) => ({
      ...s,
      userNotes: s.userNotes.map((n) => (n.id === annoId ? { ...n, ...patch, updatedAt: Date.now() } : n)),
    }));
  },
  deleteNote(id: string, annoId: string) {
    mutate(id, (s) => {
      // prune the orphan resolved/applied keys too
      const resolved = { ...s.resolved }; delete resolved[annoId];
      const applied = { ...s.applied }; delete applied[annoId];
      return { ...s, userNotes: s.userNotes.filter((n) => n.id !== annoId), resolved, applied };
    });
  },
  setReportEdits(id: string, edits: Partial<ReviewReport>) {
    mutate(id, (s) => ({ ...s, reportEdits: { ...s.reportEdits, ...edits } }));
  },
  addVersion(id: string, version: PaperVersion) {
    mutate(id, (s) => ({ ...s, versions: [...(s.versions ?? []), version] }));
  },
};
