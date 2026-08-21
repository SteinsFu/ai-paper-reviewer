# Margin — AI Peer-Review Copilot

A generative-AI system that helps faculty, researchers and students review academic
papers: reviewer-style feedback on writing quality, structure, methodology, logical
consistency, novelty and citations, with visual before/after feedback and a
structured, exportable review report. It assists human judgment, never replaces it.

## Repository layout

- `app/` — **the product**: a Vite + React 19 + TypeScript SPA. All work happens here.
- `Paper-reviewer/` — the original Claude Design prototype export. **Frozen reference,
  never edit.** Its `screenshots/` are the visual baseline the app was ported from.

## Commands

```bash
cd app
npm run dev        # dev server
npm run build      # type-check (tsc -b) + production build
npm run preview    # serve the production build
```

Deploy: Vercel, with the project **root directory set to `app/`** (`vercel.json`
provides the SPA rewrite so deep links like `/paper/p1/novelty` work).

## Architecture

Data flows one way: **screens → hooks → `services/`**.

- `src/services/types.ts` — every shared data shape (`ReviewBundle`, `Annotation`, …).
- `src/services/api.ts` — the `MarginApi` contract: `getLibrary()`, `getReview(id)`
  (returns one `ReviewBundle` per paper), `analyze()` (an `AsyncIterable` of progress
  events), `exportReport()`.
- `src/services/mockApi.ts` — current implementation; serves `src/data/mock.ts` with
  realistic latency. `src/services/index.ts` is the entry point and switches on
  `VITE_API_MODE` (only `mock` exists today).
- `src/services/copilot.ts` — chat contract: `streamReply(messages, ctx)` returns
  `AsyncIterable<string>`. Mock matches keyword intents in `src/data/copilotScript.ts`.
- **Rule: screens never import `data/mock.ts` for review data** — they go through
  `useReview()` / `useLibrary()` (`src/hooks/useReview.ts`) or the service. The only
  exception is presentation taxonomies (`CATEGORIES`, `SEVERITY`, `RECS`, `CAT_ORDER`),
  which are UI config, not data.

Routing (`src/App.tsx`): `/` dashboard · `/new` upload+analyzing ·
`/paper/:id/{reader,visual,novelty,report}` under `PaperLayout`, which fetches the
bundle once and shares it via outlet context (`usePaperBundle()`) and pushes it into
`src/state/AppState.tsx` so the sidebar badge, topbar health score and chat panel can
read it. `AppState` also holds chat/palette visibility and the shared
resolved/applied annotation maps (that's why applying a fix decrements the sidebar badge).

The reader supports deep-linking to a note: `/paper/p1/reader?note=a3` (used by the
command palette and the visual screen). The report screen honours `?print=1`.

## Design system

- **All colors are CSS custom properties in `src/styles/tokens.css` — never hardcode
  hex/rgba in components.** Dark mode is a `[data-theme="dark"]` token override block;
  one stray hex breaks it. Composite tokens exist for gradients/frosted surfaces
  (`--grad-card`, `--grad-thumb`, `--frost-*`, `--hover-wash`, `--track`, …).
- Theme: `useTheme` (light/dark/system, persisted at `localStorage["margin-theme"]`,
  applied as `data-theme` on `<html>`; a pre-paint script in `index.html` prevents
  flash). Hotkey ⌘⇧L; ⌘K palette; ⌘J chat.
- Icons: `src/components/Icon.tsx` — single stroke set, 24×24 viewBox, strokeWidth 1.7.
  Add new paths there; don't import icon libraries.
- Motion: `motion` (framer-motion). House spring is
  `{ type:"spring", stiffness:380, damping:32 }`; `MotionConfig reducedMotion="user"`
  is set globally — never animate without respecting it. CSS micro-animations live in
  `src/styles/motion.css`.
- Styling: hand-rolled CSS (`styles/components.css` for repeated atoms: `.card`,
  `.btn`, `.chip`, `.seg`, `.pop`, `.kbd`, `.skeleton`). Inline styles are fine for
  one-offs; promote repeated patterns to a class. No Tailwind.
- Numbers that change (scores, counts) get the `.num` class (tabular-nums).
- Print/PDF: `src/lib/exportReport.ts` + `src/styles/print.css`. `printReport()`
  temporarily forces light theme and sets `body[data-printing="report"]`. Mark
  screen-only chrome with `.no-print`.

## Swapping in the real AI backend (phase 2, not built)

1. Create Vercel serverless functions under `app/api/` (e.g. `api/chat.ts`) using
   `@anthropic-ai/sdk`: `client.messages.stream({ model: "claude-opus-4-8", system:
   reviewer persona + serialized ReviewBundle, messages })`, piped out as an SSE /
   ReadableStream response. Key lives in Vercel env `ANTHROPIC_API_KEY` — never in
   client code.
2. Implement `httpApi: MarginApi` and `httpCopilot: CopilotService` (read the fetch
   body stream and yield text chunks — the UI already consumes `AsyncIterable<string>`).
3. Wire both in `src/services/index.ts` behind `VITE_API_MODE=http`.
   Nothing above the service layer should change.

## Verification checklist

- `npm run build` must pass (tsc is part of it).
- Walk all six screens in light **and** dark; look for stuck-light surfaces (means a
  hardcoded color sneaked in).
- Upload → analyzing pipeline → lands on reader. Apply a fix on a note with a rewrite
  (a1/a9): manuscript text crossfades, sidebar badge decrements.
- ⌘K palette keyboard-only pass; Esc closes palette before chat.
- Chat: each scripted intent (novelty, sample size, figure, weaknesses, citations,
  recommendation, writing) streams a canned answer; anything else hits the fallback.
- Report: Copy puts Markdown on the clipboard; Export → `.md` downloads; Export → PDF
  opens print dialog showing only the report, light-themed.
