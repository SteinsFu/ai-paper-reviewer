import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { api } from "../services";
import { libraryStore } from "../services/libraryStore";
import { reviewStore, EMPTY_REVIEW } from "../services/reviewStore";
import type { PaperReviewState } from "../services/reviewStore";
import { loadAllReviews } from "../services/searchIndex";
import { CAT_ORDER } from "../data/mock";
import type {
  Annotation, CategoryId, LibraryPaper, ReviewBundle, ReviewReport, SeverityId, VenueSuggestions,
} from "../services/types";

interface Async<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** re-run the fetch (used by the error-state Retry button) */
  reload: () => void;
}

interface LibraryState extends Async<LibraryPaper[]> {
  /** permanently remove a review from the workspace */
  remove: (id: string) => Promise<void>;
  /** file a finished review into (true) or out of (false) the archive */
  setArchived: (id: string, archived: boolean) => Promise<void>;
}

export function useReview(paperId: string): Async<ReviewBundle> {
  const [state, setState] = useState<Omit<Async<ReviewBundle>, "reload">>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    setState({ data: null, loading: true, error: null });
    api.getReview(paperId)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((e) => alive && setState({ data: null, loading: false, error: String(e) }));
    return () => { alive = false; };
  }, [paperId, nonce]);
  return { ...state, reload };
}

/** Publication-venue recommendations for a paper ("Where to publish" tab). */
export function useVenues(paperId: string): Async<VenueSuggestions> & {
  refreshing: boolean;
  reanalyze: () => void;
} {
  const [state, setState] = useState<Omit<Async<VenueSuggestions>, "reload">>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    setState({ data: null, loading: true, error: null });
    api.getVenues(paperId)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((e) => alive && setState({ data: null, loading: false, error: String(e) }));
    return () => { alive = false; };
  }, [paperId, nonce]);
  const reanalyze = useCallback(() => {
    setRefreshing(true);
    api.refreshVenues(paperId)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((e) => setState((s) => ({ ...s, error: String(e) })))
      .finally(() => setRefreshing(false));
  }, [paperId]);
  return { ...state, reload, refreshing, reanalyze };
}

export function useLibrary(): LibraryState {
  // live workspace list — stays in sync across Dashboard, Sidebar, etc.
  const data = useSyncExternalStore(libraryStore.subscribe, libraryStore.getSnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    api.getLibrary()
      .then((list) => {
        if (!alive) return;
        libraryStore.replace(list);
        setLoading(false);
      })
      .catch((e) => alive && (setError(String(e)), setLoading(false)));
    return () => { alive = false; };
  }, [nonce]);

  const remove = useCallback(async (id: string) => {
    libraryStore.replace(await api.deletePaper(id));
  }, []);
  const setArchived = useCallback(async (id: string, archived: boolean) => {
    libraryStore.replace(await api.setArchived(id, archived));
  }, []);

  return { data, loading, error, reload, remove, setArchived };
}

export interface ReviewStateApi extends PaperReviewState {
  toggleResolved: (annoId: string, value?: boolean) => void;
  applyFix: (annoId: string) => void;
  addNote: (note: Annotation) => void;
  updateNote: (annoId: string, patch: Partial<Annotation>) => void;
  deleteNote: (annoId: string) => void;
  setReportEdits: (edits: Partial<ReviewReport>) => void;
}

/** Subscribe to one paper's persisted review state + bound mutators.
    The store returns a stable whole-map snapshot; we read the paper slice
    (falling back to a frozen EMPTY constant so unseen papers stay stable). */
export function useReviewState(paperId: string): ReviewStateApi {
  const map = useSyncExternalStore(reviewStore.subscribe, reviewStore.getSnapshot);
  const slice = map[paperId] ?? EMPTY_REVIEW;
  return useMemo(() => ({
    ...slice,
    toggleResolved: (annoId, value) => reviewStore.toggleResolved(paperId, annoId, value),
    applyFix: (annoId) => reviewStore.applyFix(paperId, annoId),
    addNote: (note) => reviewStore.addNote(paperId, note),
    updateNote: (annoId, patch) => reviewStore.updateNote(paperId, annoId, patch),
    deleteNote: (annoId) => reviewStore.deleteNote(paperId, annoId),
    setReportEdits: (edits) => reviewStore.setReportEdits(paperId, edits),
  }), [slice, paperId]);
}

/* -------------------------------------------------------------------------
   Workspace analytics — aggregated across every reviewed paper, combining
   the AI review bundles with the reviewer's persisted resolutions + own notes.
   ------------------------------------------------------------------------- */
export interface CategoryStat { cat: CategoryId; avg: number; issues: number }
export interface SeverityStat { sev: SeverityId; open: number; resolved: number; total: number }
export interface RevisionStat {
  paperId: string; paperTitle: string; fromLabel: string; toLabel: string;
  overallFrom: number; overallTo: number; overallDelta: number;
  catDeltas: { cat: CategoryId; delta: number }[];
}
export interface Analytics {
  loading: boolean;
  papersReviewed: number;
  avgOverall: number;
  totalNotes: number;
  openNotes: number;
  resolvedNotes: number;
  userNoteCount: number;
  categoryStats: CategoryStat[];
  severityStats: SeverityStat[];
  revisions: RevisionStat[];
}

export function useAnalytics(): Analytics {
  const reviewMap = useSyncExternalStore(reviewStore.subscribe, reviewStore.getSnapshot);
  const library = useSyncExternalStore(libraryStore.subscribe, libraryStore.getSnapshot);
  const [bundles, setBundles] = useState<Record<string, ReviewBundle> | null>(null);

  useEffect(() => {
    let alive = true;
    loadAllReviews().then((b) => alive && setBundles(b)).catch(() => alive && setBundles({}));
    return () => { alive = false; };
  }, []);

  return useMemo<Analytics>(() => {
    if (!bundles) {
      return {
        loading: true, papersReviewed: 0, avgOverall: 0, totalNotes: 0, openNotes: 0,
        resolvedNotes: 0, userNoteCount: 0, categoryStats: [], severityStats: [], revisions: [],
      };
    }
    const entries = Object.entries(bundles);
    const papersReviewed = entries.length;
    const avgOverall = papersReviewed
      ? Math.round(entries.reduce((s, [, b]) => s + b.paper.overall, 0) / papersReviewed) : 0;

    // per-category averages + issue tallies
    const catSum: Record<string, number> = {};
    const catIssues: Record<string, number> = {};
    for (const id of CAT_ORDER) { catSum[id] = 0; catIssues[id] = 0; }
    for (const [, b] of entries) for (const id of CAT_ORDER) catSum[id] += b.scores[id] ?? 0;

    // severity + note tallies (AI annotations + the reviewer's own notes)
    const sev: Record<SeverityId, { open: number; resolved: number }> = {
      critical: { open: 0, resolved: 0 }, moderate: { open: 0, resolved: 0 }, minor: { open: 0, resolved: 0 },
    };
    let totalNotes = 0, openNotes = 0, userNoteCount = 0;
    const tally = (notes: Annotation[], resolved: Record<string, boolean>) => {
      for (const n of notes) {
        totalNotes++;
        catIssues[n.cat] = (catIssues[n.cat] ?? 0) + 1;
        const isResolved = !!resolved[n.id];
        if (isResolved) sev[n.sev].resolved++; else { sev[n.sev].open++; openNotes++; }
      }
    };
    for (const [pid, b] of entries) {
      const slice = reviewMap[pid] ?? EMPTY_REVIEW;
      tally(b.annotations, slice.resolved);
      tally(slice.userNotes, slice.resolved);
      userNoteCount += slice.userNotes.length;
    }

    const categoryStats: CategoryStat[] = CAT_ORDER.map((cat) => ({
      cat, avg: papersReviewed ? Math.round(catSum[cat] / papersReviewed) : 0, issues: catIssues[cat] ?? 0,
    }));
    const severityStats: SeverityStat[] = (["critical", "moderate", "minor"] as SeverityId[]).map((s) => ({
      sev: s, open: sev[s].open, resolved: sev[s].resolved, total: sev[s].open + sev[s].resolved,
    }));

    // revision deltas: seeded versions + any synthesized ones from the store
    const revisions: RevisionStat[] = [];
    for (const p of library) {
      const seeded = p.versions ?? [];
      const synthesized = reviewMap[p.id]?.versions ?? [];
      const all = [...seeded, ...synthesized];
      if (all.length < 2) continue;
      const from = all[all.length - 2];
      const to = all[all.length - 1];
      revisions.push({
        paperId: p.id, paperTitle: p.title,
        fromLabel: from.label, toLabel: to.label,
        overallFrom: from.bundle.paper.overall, overallTo: to.bundle.paper.overall,
        overallDelta: to.bundle.paper.overall - from.bundle.paper.overall,
        catDeltas: CAT_ORDER.map((cat) => ({ cat, delta: (to.bundle.scores[cat] ?? 0) - (from.bundle.scores[cat] ?? 0) })),
      });
    }

    return {
      loading: false, papersReviewed, avgOverall, totalNotes, openNotes,
      resolvedNotes: totalNotes - openNotes, userNoteCount, categoryStats, severityStats, revisions,
    };
  }, [bundles, reviewMap, library]);
}
