import { useLocation } from "react-router-dom";
import { Icon } from "./Icon";
import { useAppState } from "../state/AppState";

const TITLES: [RegExp, string][] = [
  [/^\/$/, "Dashboard"],
  [/^\/new/, "New review"],
  [/^\/analytics/, "Analytics"],
  [/\/reader/, "Reviewer notes"],
  [/\/visual/, "Visual feedback"],
  [/\/novelty/, "Novelty & citations"],
  [/\/report/, "Review report"],
  [/\/compare/, "Compare versions"],
  [/\/publish/, "Where to publish"],
];

export function Topbar() {
  const { pathname } = useLocation();
  const { bundle, setChatOpen, setPaletteOpen, setSidebarOpen } = useAppState();
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "Margin";
  const onPaper = pathname.startsWith("/paper/") && bundle != null;

  return (
    <div className="topbar">
      <button className="icon-btn hamburger" title="Menu" aria-label="Open menu"
        onClick={() => setSidebarOpen(true)}>
        <Icon name="menu" size={19}/>
      </button>
      <h1>{title}</h1>
      {onPaper && (
        <>
          <span className="crumb">·</span>
          <span className="crumb" style={{ maxWidth:340, overflow:"hidden", textOverflow:"ellipsis",
            whiteSpace:"nowrap" }}>{bundle.paper.title}</span>
        </>
      )}
      <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:7 }}>
        {onPaper && (
          <div style={{ display:"flex", alignItems:"center", gap:7, marginRight:8 }}>
            <span style={{ fontSize:12.5, color:"var(--text-2)", fontWeight:500 }}>Health</span>
            <span className="num" style={{ fontSize:14, fontWeight:700, color:"var(--accent-deep)" }}>
              {bundle.paper.overall}
            </span>
            <span style={{ fontSize:12.5, color:"var(--text-4)" }}>/100</span>
          </div>
        )}
        <button className="icon-btn" title="Search & commands (⌘K)" onClick={() => setPaletteOpen(true)}>
          <Icon name="search" size={17}/>
        </button>
        <button className="icon-btn" title="Ask the reviewer (⌘J)" onClick={() => setChatOpen(true)}>
          <Icon name="spark" size={17}/>
        </button>
      </div>
    </div>
  );
}
