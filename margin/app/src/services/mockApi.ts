/* ============================================================
   Margin — mock backend
   Serves the sample data with realistic latency so loading
   states are visible and the UI is honest about being async.
   ============================================================ */
import type { CreateNoteInput, MarginApi } from "./api";
import type { AnalyzeInput, AnalyzeProgress, Note, ReviewBundle, VenueFieldTag, VenueSuggestions } from "./types";
import { libraryStore } from "./libraryStore";
import { BUNDLES, PIPELINE } from "../data/mock";
import { matchScore, venuesFor } from "../data/venues";

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
const jitter = () => 180 + Math.random() * 220;

// papers without a dedicated review (e.g. the p4 draft) fall back to p1's sample
const bundleFor = (id: string) => BUNDLES[id] ?? BUNDLES.p1;

const MOCK_FIELD_TAGS: Record<string, { primary: VenueFieldTag; secondary: VenueFieldTag | null }> = {
  p1: { primary: "hci", secondary: "nlp" },
  p2: { primary: "ml", secondary: "nlp" },
  p3: { primary: "haptics", secondary: "hci" },
  p5: { primary: "se", secondary: null },
};

function inferMockTag(field: string): VenueFieldTag {
  const f = field.toLowerCase();
  if (f.includes("language") || f.includes("nlp")) return "nlp";
  if (f.includes("software")) return "se";
  if (f.includes("haptic")) return "haptics";
  if (f.includes("health") || f.includes("medical")) return "ml4h";
  if (f.includes("vision") || f.includes("graphic")) return "cv";
  if (f.includes("security")) return "security";
  if (f.includes("human") || f.includes("interaction")) return "hci";
  return "ml";
}

async function* analyze(_input: AnalyzeInput): AsyncIterable<AnalyzeProgress> {
  const perStep = 760;
  const steps = PIPELINE;
  const total = perStep * steps.length;
  const tick = 40;
  let elapsed = 0;
  while (elapsed < total) {
    await delay(tick);
    elapsed += tick;
    yield {
      step: Math.min(steps.length, Math.floor(elapsed / perStep)),
      steps,
      pct: Math.min(100, Math.round((elapsed / total) * 100)),
      done: false,
    };
  }
  yield { step: steps.length, steps, pct: 100, done: true, paperId: "p1" };
}

export const mockApi: MarginApi = {
  async getLibrary() {
    await delay(jitter());
    return libraryStore.getSnapshot();
  },
  async getReview(paperId: string) {
    await delay(jitter());
    return bundleFor(paperId);
  },
  async getAllReviews() {
    await delay(jitter());
    // map the live (non-deleted) library to a bundle each, skipping drafts
    const out: Record<string, ReviewBundle> = {};
    for (const p of libraryStore.getSnapshot()) {
      if (p.status === "draft") continue;
      out[p.id] = bundleFor(p.id);
    }
    return out;
  },
  async getVenues(paperId: string) {
    await delay(jitter());
    const bundle = bundleFor(paperId);
    const venues = venuesFor(paperId).map((v) => ({
      ...v,
      match: matchScore(v, bundle.paper.overall),
      tag: inferMockTag(v.field),
    }));
    const tags = MOCK_FIELD_TAGS[paperId] ?? MOCK_FIELD_TAGS.p1;
    return { ...tags, venues } satisfies VenueSuggestions;
  },
  async refreshVenues(paperId: string) {
    return mockApi.getVenues(paperId);
  },
  analyze,
  async exportReport(paperId: string) {
    await delay(60);
    return bundleFor(paperId).report;
  },
  async deletePaper(paperId: string) {
    await delay(jitter());
    libraryStore.remove(paperId);
    return libraryStore.getSnapshot();
  },
  async setArchived(paperId: string, archived: boolean) {
    await delay(jitter());
    libraryStore.setArchived(paperId, archived);
    return libraryStore.getSnapshot();
  },

  /* ---- Notes (in-memory per-session store) ------------------------- */
  async listNotes(paperId: string) {
    await delay(60);
    return notesFor(paperId).map((n) => ({ ...n }));
  },
  async createNote(paperId: string, input: CreateNoteInput) {
    await delay(60);
    const list = notesFor(paperId);
    const parent = input.parentNoteId
      ? list.find((n) => n.id === input.parentNoteId)
      : null;
    const now = Date.now();
    const note: Note = {
      id: `n_${Math.random().toString(36).slice(2, 12)}`,
      paperId,
      // Flatten replies-to-replies to the root (Slack-style 1-level threads).
      parentNoteId: parent ? (parent.parentNoteId ?? parent.id) : null,
      authorId: "mock@local",
      authorName: "You",
      body: input.body,
      anchor: input.anchor ?? null,
      createdAt: now,
      updatedAt: now,
    };
    list.push(note);
    return { ...note };
  },
  async updateNote(paperId: string, noteId: string, body: string) {
    await delay(40);
    const list = notesFor(paperId);
    const n = list.find((x) => x.id === noteId);
    if (!n) throw new Error(`note ${noteId} not found`);
    n.body = body;
    n.updatedAt = Date.now();
    return { ...n };
  },
  async deleteNote(paperId: string, noteId: string) {
    await delay(40);
    const list = notesFor(paperId);
    const idx = list.findIndex((x) => x.id === noteId);
    if (idx >= 0) list.splice(idx, 1);
    // cascade replies
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].parentNoteId === noteId) list.splice(i, 1);
    }
  },
  async markNotesRead(_paperId: string) {
    await delay(20);
  },
};

/* In-memory per-session notes so the mock can demonstrate the flow without
   the FastAPI server. Resets on page reload. */
const _mockNotes: Record<string, Note[]> = {};
function notesFor(paperId: string): Note[] {
  if (!_mockNotes[paperId]) _mockNotes[paperId] = [];
  return _mockNotes[paperId];
}
