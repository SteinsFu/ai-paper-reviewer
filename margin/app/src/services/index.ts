/* ============================================================
   Margin — service entry point
   VITE_API_MODE=http will select the real backend once it
   exists (see CLAUDE.md). Until then everything is mock.
   ============================================================ */
import type { MarginApi } from "./api";
import { mockApi } from "./mockApi";

const mode = import.meta.env.VITE_API_MODE ?? "mock";

if (mode === "http") {
  console.warn("VITE_API_MODE=http requested but no HTTP backend exists yet — using mock.");
}

export const api: MarginApi = mockApi;
export { copilot } from "./copilot";
export type { MarginApi } from "./api";
export type { CopilotService } from "./copilot";
