/* ============================================================
   Margin — service entry point
   VITE_API_MODE=http selects the real HTTP backend (server.py
   in this repo root) for both the review pipeline and the chat
   copilot. Default remains "mock" for standalone demos without
   the Python server running.
   ============================================================ */
import type { MarginApi } from "./api";
import type { CopilotService } from "./copilot";
import { mockApi } from "./mockApi";
import { httpApi } from "./httpApi";
import { copilot as mockCopilot } from "./copilot";
import { httpCopilot } from "./httpCopilot";
import { libraryStore } from "./libraryStore";

const mode = import.meta.env.VITE_API_MODE ?? "mock";
if (mode !== "http") libraryStore.seedFromMock();

export const api: MarginApi = mode === "http" ? httpApi : mockApi;
export const copilot: CopilotService = mode === "http" ? httpCopilot : mockCopilot;
export type { MarginApi } from "./api";
export type { CopilotService } from "./copilot";
