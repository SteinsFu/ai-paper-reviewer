/* ============================================================
   Margin — HTTP backend
   Implements MarginApi against the Python FastAPI server in
   this repo's root (server.py). Base URL is taken from
   VITE_API_BASE_URL (default http://localhost:8000).
   ============================================================ */
import type { MarginApi } from "./api";
import type {
  AnalyzeInput, AnalyzeProgress, LibraryPaper, ReviewBundle, ReviewReport, VenueSuggestions,
} from "./types";

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${res.statusText}: ${detail}`);
  }
  return (await res.json()) as T;
}

/** Parse a Server-Sent Events response body into decoded `data:` payloads. */
async function* readSse(res: Response): AsyncIterable<string> {
  if (!res.body) throw new Error("SSE response has no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLines = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      if (dataLines.length) yield dataLines.join("\n");
    }
  }
  // Flush any final partial frame.
  const remaining = buffer.trim();
  if (remaining.startsWith("data:")) yield remaining.slice(5).trim();
}

async function* analyze(input: AnalyzeInput): AsyncIterable<AnalyzeProgress> {
  const fd = new FormData();
  if (input.file) {
    fd.append("file", input.file, input.fileName ?? input.file.name);
  } else {
    // The mock UI has a click-to-analyze path that never picks a real file; keep
    // a small synthetic upload so the endpoint still returns something useful.
    const blob = new Blob(["Untitled draft.\n\nNo content was uploaded."], { type: "text/plain" });
    fd.append("file", blob, "untitled.txt");
  }

  const res = await fetch(`${BASE_URL}/analyze`, { method: "POST", body: fd });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${res.statusText}: ${detail}`);
  }
  for await (const raw of readSse(res)) {
    try {
      yield JSON.parse(raw) as AnalyzeProgress;
    } catch {
      // Skip malformed frames rather than crashing the whole stream.
      continue;
    }
  }
}

export const httpApi: MarginApi = {
  getLibrary: () => json<LibraryPaper[]>("/library"),

  getReview: (paperId) => json<ReviewBundle>(`/paper/${encodeURIComponent(paperId)}`),

  async getAllReviews() {
    const lib = await json<LibraryPaper[]>("/library");
    const entries = await Promise.all(
      lib
        .filter((p) => p.status !== "draft")
        .map(async (p) => [p.id, await json<ReviewBundle>(`/paper/${encodeURIComponent(p.id)}`)] as const),
    );
    return Object.fromEntries(entries);
  },

  getVenues: (paperId) => json<VenueSuggestions>(`/paper/${encodeURIComponent(paperId)}/venues`),

  analyze,

  exportReport: (paperId) => json<ReviewReport>(`/paper/${encodeURIComponent(paperId)}/report`),

  deletePaper: (paperId) =>
    json<LibraryPaper[]>(`/paper/${encodeURIComponent(paperId)}`, { method: "DELETE" }),

  setArchived: (paperId, archived) =>
    json<LibraryPaper[]>(`/paper/${encodeURIComponent(paperId)}`, {
      method: "PATCH",
      body: JSON.stringify({ archived }),
    }),
};
