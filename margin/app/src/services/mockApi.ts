/* ============================================================
   Margin — mock backend
   Serves the sample data with realistic latency so loading
   states are visible and the UI is honest about being async.
   ============================================================ */
import type { MarginApi } from "./api";
import type { AnalyzeInput, AnalyzeProgress, ReviewBundle } from "./types";
import { libraryStore } from "./libraryStore";
import { BUNDLES, PIPELINE } from "../data/mock";
import { venuesFor } from "../data/venues";

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
const jitter = () => 180 + Math.random() * 220;

// papers without a dedicated review (e.g. the p4 draft) fall back to p1's sample
const bundleFor = (id: string) => BUNDLES[id] ?? BUNDLES.p1;

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
    return venuesFor(paperId);
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
};
