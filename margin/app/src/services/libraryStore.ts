/* ============================================================
   Margin — library store
   The workspace list is the one piece of app data the user
   mutates (delete a review, archive a finished one), so it
   lives in a tiny observable store instead of a static const.

   It layers persisted mutations (deletions + per-paper patches)
   over the seed LIBRARY, so demo edits survive a reload while
   new seed papers still show up. mockApi reads it; useLibrary
   subscribes to it via useSyncExternalStore.
   ============================================================ */
import { LIBRARY } from "../data/mock";
import type { LibraryPaper } from "./types";

const KEY = "margin-library-state";

interface Persisted {
  deleted: string[];
  patch: Record<string, Partial<LibraryPaper>>;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>;
      return { deleted: p.deleted ?? [], patch: p.patch ?? {} };
    }
  } catch { /* ignore malformed / unavailable storage */ }
  return { deleted: [], patch: {} };
}

function save(p: Persisted) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

let state = load();
const listeners = new Set<() => void>();

/** cached derived list — stable reference until a mutation recomputes it
    (useSyncExternalStore requires getSnapshot to be referentially stable) */
let snapshot: LibraryPaper[] = derive();

function derive(): LibraryPaper[] {
  return LIBRARY
    .filter((p) => !state.deleted.includes(p.id))
    .map((p) => (state.patch[p.id] ? { ...p, ...state.patch[p.id] } : p));
}

function commit() {
  save(state);
  snapshot = derive();
  listeners.forEach((l) => l());
}

export const libraryStore = {
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  },
  getSnapshot(): LibraryPaper[] {
    return snapshot;
  },
  remove(id: string) {
    if (!state.deleted.includes(id)) state.deleted = [...state.deleted, id];
    const { [id]: _drop, ...rest } = state.patch;
    state.patch = rest;
    commit();
  },
  setArchived(id: string, archived: boolean) {
    const prev = state.patch[id] ?? {};
    // archiving a review also records it as done — that's the point of filing it away.
    // (the "current paper" pointer is owned by AppState and cleared there on archive.)
    state.patch = {
      ...state.patch,
      [id]: archived ? { ...prev, archived: true, status: "done" } : { ...prev, archived: false },
    };
    commit();
  },
};
