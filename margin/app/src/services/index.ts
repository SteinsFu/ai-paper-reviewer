/* ============================================================
   Margin — service entry point
   VITE_API_MODE=http selects the real HTTP backend (server.py
   in this repo root). Default remains "mock" for standalone
   demos without the Python server running.
   ============================================================ */
import type { MarginApi } from "./api";
import { mockApi } from "./mockApi";
import { httpApi } from "./httpApi";

const mode = import.meta.env.VITE_API_MODE ?? "mock";

export const api: MarginApi = mode === "http" ? httpApi : mockApi;
export { copilot } from "./copilot";
export type { MarginApi } from "./api";
export type { CopilotService } from "./copilot";
