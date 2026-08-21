/* ============================================================
   Margin — app-level UI state
   Chat/palette/sidebar visibility, the current paper's review bundle
   (pushed up by PaperLayout so Sidebar/Topbar/Chat can read it),
   and auth. The per-paper resolved/applied/notes state lives in
   reviewStore (persisted) — see hooks/useReview.ts#useReviewState.
   ============================================================ */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ReviewBundle } from "../services/types";

export type UserRole = "student" | "professor";
export interface Account {
  email: string;
  role: UserRole;
  name?: string;
}

interface AppState {
  account: Account | null;
  signIn: (account: Account) => void;
  signOut: () => void;
  chatOpen: boolean;
  setChatOpen: (b: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (b: boolean) => void;
  /** off-canvas sidebar drawer (narrow viewports) */
  sidebarOpen: boolean;
  setSidebarOpen: (b: boolean) => void;
  bundle: ReviewBundle | null;
  setBundle: (b: ReviewBundle | null) => void;
  /** the paper the workspace is focused on — set when you open one, cleared on archive/delete */
  currentPaperId: string | null;
  setCurrentPaper: (id: string | null) => void;
  /** manual replay of the first-run onboarding tour (from Settings) */
  tourOpen: boolean;
  openTour: () => void;
  closeTour: () => void;
}

const CURRENT_KEY = "margin-current-paper";
const AUTH_KEY = "margin-auth";

function loadAccount(): Account | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Account;
    if (a && typeof a.email === "string" && (a.role === "student" || a.role === "professor")) return a;
  } catch { /* ignore */ }
  return null;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [account, setAccount] = useState<Account | null>(loadAccount);
  const [bundle, setBundle] = useState<ReviewBundle | null>(null);
  const [currentPaperId, setCurrentPaperIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(CURRENT_KEY) ?? "p1"; } catch { return "p1"; }
  });
  const [tourOpen, setTourOpen] = useState(false);
  const openTour = useCallback(() => setTourOpen(true), []);
  const closeTour = useCallback(() => setTourOpen(false), []);

  const signIn = useCallback((acc: Account) => {
    setAccount(acc);
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(acc)); } catch { /* ignore */ }
  }, []);

  const signOut = useCallback(() => {
    setAccount(null);
    try { localStorage.removeItem(AUTH_KEY); } catch { /* ignore */ }
  }, []);

  const setCurrentPaper = useCallback((id: string | null) => {
    setCurrentPaperIdState(id);
    try {
      if (id) localStorage.setItem(CURRENT_KEY, id);
      else localStorage.removeItem(CURRENT_KEY);
    } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({
    account, signIn, signOut,
    chatOpen, setChatOpen, paletteOpen, setPaletteOpen, sidebarOpen, setSidebarOpen,
    bundle, setBundle, currentPaperId, setCurrentPaper,
    tourOpen, openTour, closeTour,
  }), [account, signIn, signOut, chatOpen, paletteOpen, sidebarOpen, bundle, currentPaperId, setCurrentPaper,
    tourOpen, openTour, closeTour]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState outside AppStateProvider");
  return v;
}
