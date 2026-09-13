/* ============================================================
   Margin — backend contract
   Screens talk to this interface only. Today it's implemented
   by mockApi; a real HTTP backend implements the same shape.
   ============================================================ */
import type {
  AnalyzeInput, AnalyzeProgress, LibraryPaper, Note, ReviewBundle, ReviewReport,
  TextAnchor, VenueSuggestions,
} from "./types";

export interface CreateNoteInput {
  body: string;
  parentNoteId?: string | null;
  anchor?: TextAnchor | null;
}

export interface MarginApi {
  getLibrary(): Promise<LibraryPaper[]>;
  getReview(paperId: string): Promise<ReviewBundle>;
  /** every non-draft paper's review bundle, keyed by id — powers cross-paper
      search (F4) and analytics (F6) without N round-trips */
  getAllReviews(): Promise<Record<string, ReviewBundle>>;
  /** conferences & journals that fit a paper, for the "Where to publish" tab */
  getVenues(paperId: string): Promise<VenueSuggestions>;
  /** re-classify venues for this paper, ignoring cache */
  refreshVenues(paperId: string): Promise<VenueSuggestions>;
  analyze(input: AnalyzeInput): AsyncIterable<AnalyzeProgress>;
  exportReport(paperId: string): Promise<ReviewReport>;
  /** permanently remove a review from the workspace; resolves to the new library */
  deletePaper(paperId: string): Promise<LibraryPaper[]>;
  /** file a finished review into (or out of) the archive; resolves to the new library */
  setArchived(paperId: string, archived: boolean): Promise<LibraryPaper[]>;

  /* ---- user-authored notes (comments) -------------------------------- */
  /** list every note on the paper, oldest first */
  listNotes(paperId: string): Promise<Note[]>;
  /** add a root note or a reply (parentNoteId) */
  createNote(paperId: string, input: CreateNoteInput): Promise<Note>;
  /** edit a note's body (author only) */
  updateNote(paperId: string, noteId: string, body: string): Promise<Note>;
  /** delete a note (author only); replies cascade */
  deleteNote(paperId: string, noteId: string): Promise<void>;
  /** mark every note on the paper as read for the caller */
  markNotesRead(paperId: string): Promise<void>;
}
