/* ============================================================
   Margin — HTTP copilot service
   Streams multi-turn chat responses from the FastAPI backend
   (POST /chat, SSE). Falls back gracefully with a friendly line
   when the server is unreachable so the panel never hangs silently.
   ============================================================ */
import type { CopilotService } from "./copilot";
import type { ChatMessage, ReviewContext } from "./types";

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

/** Yield raw `data:` payloads (as strings) from an SSE response. */
async function* readSse(res: Response): AsyncIterable<string> {
  if (!res.body) throw new Error("SSE response has no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
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
  const remaining = buffer.trim();
  if (remaining.startsWith("data:")) yield remaining.slice(5).trim();
}

async function* streamReply(
  messages: ChatMessage[],
  ctx: ReviewContext,
): AsyncIterable<string> {
  const body = JSON.stringify({
    paperId: ctx.paperId,
    messages,
  });

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (e) {
    yield `Sorry — I could not reach the chat backend (${(e as Error).message}). Is the API server running?`;
    return;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    yield `Sorry — the chat backend returned ${res.status}: ${detail || res.statusText}`;
    return;
  }

  for await (const raw of readSse(res)) {
    let event: { delta?: string; done?: boolean; error?: string };
    try {
      event = JSON.parse(raw);
    } catch {
      continue;
    }
    if (event.error) {
      yield `\n\n(Error: ${event.error})`;
      return;
    }
    if (typeof event.delta === "string" && event.delta.length > 0) {
      yield event.delta;
    }
    if (event.done) return;
  }
}

export const httpCopilot: CopilotService = { streamReply };
