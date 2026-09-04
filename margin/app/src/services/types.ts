/* ============================================================
   Margin — shared data shapes
   The contract between screens and the (mock or real) backend.
   ============================================================ */

export type CategoryId =
  | "writing" | "structure" | "method" | "logic"
  | "novelty" | "citation" | "format";

export type SeverityId = "critical" | "moderate" | "minor";

export type Recommendation = "accept" | "minor" | "major" | "reject";

export interface Category {
  id: CategoryId;
  label: string;
  color: string;   // css var reference
  soft: string;
  hex: string;
}

export interface Severity {
  id: SeverityId;
  label: string;
  color: string;
  soft: string;
  hex: string;
  rank: number;
}

export interface Paper {
  title: string;
  authors: string;
  venue: string;
  pages: number;
  words: number;
  figures: number;
  refs: number;
  overall: number;             // /100
  recommendation: Recommendation;
}

/* Manuscript content */
export interface TextRun {
  t: string;
  a?: string;                  // annotation id
}
export interface HeadingBlock { type: "h1"; section: string; runs: TextRun[] }
export interface ParaBlock { type: "p"; section: string; runs: TextRun[] }
export interface FigureBlock {
  type: "fig";
  section: string;
  fig: string;
  caption: string;
  anno: string;
  /** data-driven chart drawn in place of the caption's figure (absent ⇒ generic placeholder) */
  plot?: PlotSpec;
  /** true ⇒ figure spans both columns in Paper view (wide plots); default in-column */
  span?: boolean;
}
export type ManuscriptBlock = HeadingBlock | ParaBlock | FigureBlock;

/* ---- Figure plots ---------------------------------------------------------
   Small, data-driven chart specs so sample figures can be real bar/line/
   scatter/box/heatmap plots (see components/FigurePlot.tsx). Invented but
   plausible numbers; rendered as token-styled SVG. */
export interface PlotSeries { name: string; values: number[]; }
/** bar chart — one or more series over the same category axis; optional error bars */
export interface BarsPlot {
  type: "bars";
  xLabel?: string; yLabel?: string;
  categories: string[];
  series: PlotSeries[];
  /** per-series, per-category ± error; omit to draw none (a common figure-hygiene issue) */
  errors?: number[][];
}
/** line chart — one or more series sharing an x axis */
export interface LinePlot {
  type: "line";
  xLabel?: string; yLabel?: string;
  x: number[];
  series: PlotSeries[];
}
/** scatter — points per series, optional linear trend line */
export interface ScatterPlot {
  type: "scatter";
  xLabel?: string; yLabel?: string;
  series: { name: string; points: [number, number][] }[];
  trend?: boolean;
}
/** box-and-whisker — one box per group */
export interface BoxPlot {
  type: "box";
  xLabel?: string; yLabel?: string;
  groups: { name: string; min: number; q1: number; median: number; q3: number; max: number }[];
}
/** heatmap / confusion matrix — value grid with row & column labels */
export interface HeatmapPlot {
  type: "heatmap";
  xLabel?: string; yLabel?: string;
  rows: string[];
  cols: string[];
  values: number[][];   // values[row][col], 0..1 for color scale
}
export type PlotSpec = BarsPlot | LinePlot | ScatterPlot | BoxPlot | HeatmapPlot;

/** one entry in a paper's reference list (bibliography) */
export interface Reference { id: string; text: string; }

/** Char-offset anchor into a single ManuscriptBlock's text — how a
    human-authored note pins itself to the manuscript. Single-block only;
    `quote` is the literal selected text, kept for re-finding & excerpts. */
export interface TextAnchor {
  blockIndex: number;
  start: number;
  end: number;
  quote: string;
}

export interface Annotation {
  id: string;
  cat: CategoryId;
  sev: SeverityId;
  section: string;
  title: string;
  excerpt: string;
  comment: string;
  suggestion?: string;
  /** when present, "Apply fix" swaps the manuscript text for this rewrite */
  rewrite?: string;
  good?: string;
  missingRef?: string;
  overlap?: number;
  isFigure?: boolean;
  /** who authored the note — absent ⇒ AI (keeps all seed data valid) */
  origin?: "ai" | "you";
  author?: string;
  createdAt?: number;
  updatedAt?: number;
  /** for human-authored notes: where in the manuscript it's pinned */
  anchor?: TextAnchor;
}

export interface VisualItem {
  id: string;
  kind: "figure" | "paragraph";
  title: string;
  cat: CategoryId;
  sev: SeverityId;
  problem: string;
  beforeLabel?: string;
  afterLabel?: string;
  before?: string;
  after?: string;
  metricBefore?: string;
  metricAfter?: string;
  fix?: string;
  /** data-driven before/after charts for figure items (fall back to a generic figure) */
  beforePlot?: PlotSpec;
  afterPlot?: PlotSpec;
}

export interface RelatedPaper {
  title: string;
  authors: string;
  venue: string;
  sim: number;                 // % similarity
  flag: "overlap" | "related" | "baseline";
  note: string;
}

export interface MissingRef {
  for?: string;                // annotation id it supports
  text: string;
  reason: string;
}

export interface NoveltyAssessment {
  score: number;
  verdict: string;
  summary: string;
  strengths: string[];
  risks: string[];
}

export interface ReviewReport {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  minor: string[];
  recommendation: Recommendation;
  confidence: number;          // 1–5
}

/** A snapshot of a review at a point in time — the unit revision comparison
    diffs against. The bundle is inlined so a synthesized v2 needs no BUNDLES entry. */
export interface PaperVersion {
  id: string;
  label: string;
  createdAt: number;
  score: number;
  openIssues: number;
  bundle: ReviewBundle;
}

export interface LibraryPaper {
  id: string;
  title: string;
  authors: string;
  venue: string;
  status: "in-review" | "done" | "draft";
  score: number | null;
  issues: number;
  updated: string;
  /** machine-readable timestamp beside the display string `updated` (analytics / version order) */
  updatedAt?: number;
  current?: boolean;
  /** filed away in the archive — kept as a record but out of the active workspace */
  archived?: boolean;
  /** seeded revision history for the compare view */
  versions?: PaperVersion[];
}

export interface PipelineStep {
  label: string;
  detail: string;
}

/* ---- Publication venue recommendations -----------------------------------
   Where the author could submit this paper: conferences & journals that align
   with its topic, each with prestige, deadline, selectivity and a fit score.
   The per-paper estimated acceptance % is computed from the paper's health,
   the fit, and the venue's selectivity (see data/venues.ts#estimateAcceptance). */
export type VenueKind = "conference" | "journal" | "workshop";

export interface PublicationVenue {
  id: string;
  name: string;                 // short name, e.g. "CHI"
  fullName: string;             // "ACM CHI Conference on Human Factors in Computing Systems"
  kind: VenueKind;
  field: string;                // "Human-Computer Interaction"
  /** esteem, 1–5 — how the community regards the venue (5 = flagship, like ICRA for robotics) */
  prestige: number;
  tierLabel: string;            // "Flagship venue", "Top-tier", "Strong", …
  esteem: string;               // one-line reputation note
  fit: number;                  // 0–100 topical alignment with this paper
  acceptanceRate: number;       // venue's historical acceptance rate (%)
  /** ISO date of the next submission deadline, or null for rolling (journals) */
  deadline: string | null;
  deadlineNote?: string;
  h5: number;                   // Google-Scholar h5-index (a prestige signal)
  location?: string;            // host city (conferences)
  url: string;                  // official venue page
  rationale: string;            // why it fits this paper
  /** 0–100 how close the paper's overall score sits to this venue's bar */
  match?: number;
}

export type VenueFieldTag = "hci" | "nlp" | "ml" | "ml4h" | "se" | "haptics" | "cv" | "systems" | "security" | "other";

export interface VenueSuggestions {
  primary: VenueFieldTag;
  secondary: VenueFieldTag | null;
  venues: PublicationVenue[];
}

/* Everything one paper review needs — one bundle, one fetch */
export interface ReviewBundle {
  paper: Paper;
  scores: Record<CategoryId, number>;
  manuscript: ManuscriptBlock[];
  annotations: Annotation[];
  visuals: VisualItem[];
  related: RelatedPaper[];
  missingRefs: MissingRef[];
  novelty: NoveltyAssessment;
  report: ReviewReport;
  /** the paper's own bibliography, rendered as a References section */
  references?: Reference[];
}

/* Analysis progress events */
export interface AnalyzeProgress {
  step: number;                // index into pipeline, steps.length = done
  steps: PipelineStep[];
  pct: number;                 // 0–100
  done: boolean;
  /** set on the `done: true` event so the caller knows which paper to open */
  paperId?: string;
  /** set on the `done: true` event when the pipeline failed on the server */
  error?: string;
}

export interface AnalyzeInput {
  fileName?: string;
  /** the manuscript file to upload; used by the HTTP backend, ignored by mock */
  file?: File;
}

/* Chat */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ReviewContext {
  paperId: string;
  paperTitle: string;
}
