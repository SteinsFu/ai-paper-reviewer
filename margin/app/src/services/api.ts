/* ============================================================
   Margin — backend contract
   Screens talk to this interface only. Today it's implemented
   by mockApi; a real HTTP backend implements the same shape.
   ============================================================ */
import type {
  AnalyzeInput, AnalyzeProgress, LibraryPaper, PublicationVenue, ReviewBundle, ReviewReport,
} from "./types";

export interface MarginApi {
  getLibrary(): Promise<LibraryPaper[]>;
  getReview(paperId: string): Promise<ReviewBundle>;
  /** every non-draft paper's review bundle, keyed by id — powers cross-paper
      search (F4) and analytics (F6) without N round-trips */
  getAllReviews(): Promise<Record<string, ReviewBundle>>;
  /** conferences & journals that fit a paper, for the "Where to publish" tab */
  getVenues(paperId: string): Promise<PublicationVenue[]>;
  analyze(input: AnalyzeInput): AsyncIterable<AnalyzeProgress>;
  exportReport(paperId: string): Promise<ReviewReport>;
  /** permanently remove a review from the workspace; resolves to the new library */
  deletePaper(paperId: string): Promise<LibraryPaper[]>;
  /** file a finished review into (or out of) the archive; resolves to the new library */
  setArchived(paperId: string, archived: boolean): Promise<LibraryPaper[]>;
}
