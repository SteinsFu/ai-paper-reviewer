/* ============================================================
   Margin — cross-paper search index
   Flattens every paper's AI annotations plus the reviewer's own
   notes (from reviewStore) into a searchable list, so the command
   palette can find a note in ANY paper, not just the open one.

   The bundle fetch is memoized at module level (built lazily on the
   first palette open); user notes come live from reviewStore so a
   note added this session is findable without a reload.
   ============================================================ */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { api } from "./index";
import { reviewStore } from "./reviewStore";
import type { ReviewBundle } from "./types";

export interface SearchEntry {
  paperId: string;
  paperTitle: string;
  noteId: string;
  title: string;
  section: string;
  origin: "ai" | "you";
  /** everything cmdk should match against */
  haystack: string;
}

let cache: Promise<Record<string, ReviewBundle>> | null = null;
/** memoized cross-paper bundle fetch (one round-trip per session) */
export function loadAllReviews(): Promise<Record<string, ReviewBundle>> {
  if (!cache) cache = api.getAllReviews().catch((e) => { cache = null; throw e; });
  return cache;
}

/** Live cross-paper note entries. Fetches bundles on first `open`, then merges
    in the reviewer's own notes from the store on every change. */
export function useSearchEntries(open: boolean): SearchEntry[] {
  const reviewMap = useSyncExternalStore(reviewStore.subscribe, reviewStore.getSnapshot);
  const [bundles, setBundles] = useState<Record<string, ReviewBundle> | null>(null);

  useEffect(() => {
    if (!open || bundles) return;
    let alive = true;
    loadAllReviews().then((b) => alive && setBundles(b)).catch(() => { /* palette still works for nav */ });
    return () => { alive = false; };
  }, [open, bundles]);

  return useMemo(() => {
    const entries: SearchEntry[] = [];
    if (bundles) {
      for (const [pid, b] of Object.entries(bundles)) {
        for (const an of b.annotations) {
          entries.push({
            paperId: pid, paperTitle: b.paper.title, noteId: an.id,
            title: an.title, section: an.section, origin: an.origin === "you" ? "you" : "ai",
            haystack: `${an.title} ${an.section} ${an.excerpt} ${an.comment} ${b.paper.title}`.toLowerCase(),
          });
        }
      }
    }
    for (const [pid, slice] of Object.entries(reviewMap)) {
      const paperTitle = bundles?.[pid]?.paper.title ?? pid;
      for (const n of slice.userNotes) {
        entries.push({
          paperId: pid, paperTitle, noteId: n.id, title: n.title, section: n.section, origin: "you",
          haystack: `${n.title} ${n.section} ${n.excerpt} ${n.comment} ${paperTitle}`.toLowerCase(),
        });
      }
    }
    return entries;
  }, [bundles, reviewMap]);
}
