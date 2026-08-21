/* ============================================================
   Margin — chat copilot service
   The UI consumes AsyncIterable<string> and nothing else, so a
   real streaming backend (see CLAUDE.md §"Swapping in the real
   backend") can replace mockCopilot without touching the panel.
   ============================================================ */
import type { ChatMessage, ReviewContext } from "./types";
import { FALLBACK, INTENTS } from "../data/copilotScript";

export interface CopilotService {
  streamReply(messages: ChatMessage[], ctx: ReviewContext): AsyncIterable<string>;
}

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

function pickReply(messages: ChatMessage[], ctx: ReviewContext): string {
  const last = messages.filter((m) => m.role === "user").at(-1)?.content.toLowerCase() ?? "";
  for (const intent of INTENTS) {
    if (intent.keywords.some((k) => last.includes(k))) return intent.reply;
  }
  return FALLBACK(ctx.paperTitle);
}

async function* streamReply(messages: ChatMessage[], ctx: ReviewContext): AsyncIterable<string> {
  const reply = pickReply(messages, ctx);
  await delay(420 + Math.random() * 380);          // "thinking"
  const words = reply.split(" ");
  let i = 0;
  while (i < words.length) {
    const n = 2 + Math.floor(Math.random() * 4);   // 2–5 words per chunk
    const chunk = words.slice(i, i + n).join(" ");
    i += n;
    yield (i - n === 0 ? "" : " ") + chunk;
    await delay(30 + Math.random() * 55);
  }
}

export const copilot: CopilotService = { streamReply };
