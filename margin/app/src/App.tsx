import { useCallback, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { CommandPalette } from "./components/CommandPalette";
import { ChatPanel } from "./components/ChatPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Onboarding, ONBOARDED_KEY } from "./components/Onboarding";
import { Intro } from "./components/Intro";
import { Auth } from "./screens/Auth";
import { Dashboard } from "./screens/Dashboard";
import { Upload } from "./screens/Upload";
import { Analytics } from "./screens/Analytics";
import { PaperLayout } from "./screens/PaperLayout";
import { Reader } from "./screens/Reader";
import { Visual } from "./screens/Visual";
import { Novelty } from "./screens/Novelty";
import { Report } from "./screens/Report";
import { Compare } from "./screens/Compare";
import { Publish } from "./screens/Publish";
import { AppStateProvider, useAppState } from "./state/AppState";
import { useTheme } from "./hooks/useTheme";
import { useHotkey } from "./hooks/useHotkey";

function Shell() {
  const theme = useTheme();
  const { setPaletteOpen, setChatOpen, paletteOpen, chatOpen, sidebarOpen, setSidebarOpen, account, tourOpen, closeTour } = useAppState();
  const location = useLocation();
  const [introDone, setIntroDone] = useState(false);
  const [onboarded, setOnboarded] = useState(() => {
    try { return !!localStorage.getItem(ONBOARDED_KEY); } catch { return true; }
  });
  const active = introDone && account != null;
  // show on first run (not yet onboarded) or when replayed from Settings
  const showTour = active && (tourOpen || !onboarded);

  useHotkey("k", useCallback(() => { if (active) setPaletteOpen(!paletteOpen); }, [active, paletteOpen, setPaletteOpen]), { meta: true });
  useHotkey("j", useCallback(() => { if (active) setChatOpen(!chatOpen); }, [active, chatOpen, setChatOpen]), { meta: true });
  useHotkey("l", useCallback(() => { if (introDone) theme.toggle(); }, [introDone, theme.toggle]), { meta: true, shift: true });
  useHotkey("Escape", useCallback(() => {
    if (paletteOpen) setPaletteOpen(false);
    else if (chatOpen) setChatOpen(false);
    else if (sidebarOpen) setSidebarOpen(false);
  }, [paletteOpen, chatOpen, sidebarOpen, setPaletteOpen, setChatOpen, setSidebarOpen]));

  // route transitions keyed by top-level section (not per tab param)
  const sectionKey = location.pathname.split("/").slice(0, 4).join("/");

  return (
    <>
      {account ? (
        <div className="app">
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div key="sidebar-backdrop" className="sidebar-backdrop"
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                transition={{ duration:0.2 }} onClick={() => setSidebarOpen(false)}/>
            )}
          </AnimatePresence>
          <Sidebar themePref={theme.pref} onThemeChange={theme.setPref}/>
          <main className="main">
            <Topbar/>
            <div className="screen">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={sectionKey}
                  initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                  transition={{ duration:0.22, ease:[0.22,0.61,0.36,1] }}
                  style={{ height:"100%" }}>
                  <ErrorBoundary key={sectionKey}>
                  <Routes location={location}>
                    <Route path="/" element={<Dashboard/>}/>
                    <Route path="/new" element={<Upload/>}/>
                    <Route path="/analytics" element={<Analytics/>}/>
                    <Route path="/paper/:id" element={<PaperLayout/>}>
                      <Route index element={<Navigate to="reader" replace/>}/>
                      <Route path="reader" element={<Reader/>}/>
                      <Route path="visual" element={<Visual/>}/>
                      <Route path="novelty" element={<Novelty/>}/>
                      <Route path="report" element={<Report/>}/>
                      <Route path="compare" element={<Compare/>}/>
                      <Route path="publish" element={<Publish/>}/>
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace/>}/>
                  </Routes>
                  </ErrorBoundary>
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
          <CommandPalette onToggleTheme={theme.toggle}/>
          <ChatPanel/>
          {showTour && <Onboarding onClose={() => { setOnboarded(true); closeTour(); }}/>}
        </div>
      ) : (
        introDone && <Auth theme={theme}/>
      )}
      <AnimatePresence>
        {!introDone && <Intro onDone={() => setIntroDone(true)}/>}
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppStateProvider>
        <Shell/>
      </AppStateProvider>
    </MotionConfig>
  );
}
