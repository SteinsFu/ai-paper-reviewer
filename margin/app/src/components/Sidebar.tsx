import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import { SettingsModal } from "./SettingsModal";
import type { SettingsSection } from "./SettingsModal";
import { useAppState } from "../state/AppState";
import type { Account } from "../state/AppState";
import { useLibrary, useReviewState } from "../hooks/useReview";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { initials } from "../screens/Auth";
import type { ThemePref } from "../hooks/useTheme";

const PAPER_NAV: { path: string; label: string; ic: IconName; badge?: boolean }[] = [
  { path: "reader",  label: "Reviewer notes",      ic: "doc", badge: true },
  { path: "visual",  label: "Visual feedback",     ic: "eye" },
  { path: "novelty", label: "Novelty & citations", ic: "compass" },
  { path: "report",  label: "Review report",       ic: "report" },
  { path: "compare", label: "Compare versions",    ic: "layers" },
  { path: "publish", label: "Where to publish",    ic: "target" },
];

export function Sidebar({ themePref, onThemeChange }: {
  themePref: ThemePref; onThemeChange: (p: ThemePref) => void;
}) {
  const { bundle, currentPaperId, account, signIn, signOut, sidebarOpen, setSidebarOpen, openTour } = useAppState();
  const { data: library } = useLibrary();
  const review = useReviewState(currentPaperId ?? "");
  const navigate = useNavigate();
  const loc = useLocation();
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  // when the drawer is open (narrow viewports) trap Tab within it
  const trapRef = useFocusTrap<HTMLElement>(sidebarOpen, { autoFocus: false });

  // navigating (which happens when you tap a drawer link) closes the drawer
  useEffect(() => { setSidebarOpen(false); }, [loc.pathname, loc.search, setSidebarOpen]);

  // open-notes badge: unresolved AI annotations + unresolved human notes for the
  // focused paper (only when the loaded bundle is that same paper)
  const openCount = useMemo<number | null>(() => {
    if (!bundle || currentPaperId == null) return null;
    const aiOpen = bundle.annotations.filter((a) => !review.resolved[a.id]).length;
    const userOpen = review.userNotes.filter((n) => !review.resolved[n.id]).length;
    return aiOpen + userOpen;
  }, [bundle, currentPaperId, review.resolved, review.userNotes]);

  const archivedCount = library?.filter((p) => p.archived).length ?? 0;
  const archiveView = loc.pathname === "/" && new URLSearchParams(loc.search).get("view") === "archived";
  const onDashboard = loc.pathname === "/" && !archiveView;

  const current = library?.find((p) => p.id === currentPaperId && !p.archived) ?? null;
  const paperId = current?.id;
  // prefer the loaded bundle's title when it's the paper we're focused on, else the library title
  const paperTitle = current
    ? (bundle && currentPaperId === paperId ? bundle.paper.title : current.title)
    : null;

  return (
    <aside ref={trapRef} className={"sidebar" + (sidebarOpen ? " open" : "")}>
      <div className="brand" role="button" style={{ cursor:"pointer" }} onClick={() => navigate("/") }>
        <div className="brand-mark" />
        <div>
          <div className="brand-name">Margin</div>
          <div className="brand-sub">Peer-review copilot</div>
        </div>
      </div>

      <div className="nav-label">Workspace</div>
      <button className={"nav-item" + (onDashboard ? " active" : "")} onClick={() => navigate("/")}>
        <Icon name="home" className="nav-ic" size={18}/>
        <span>Dashboard</span>
      </button>
      <NavLink to="/new" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
        <Icon name="plus" className="nav-ic" size={18}/>
        <span>New review</span>
      </NavLink>
      <NavLink to="/analytics" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
        <Icon name="grid" className="nav-ic" size={18}/>
        <span>Analytics</span>
      </NavLink>
      <button className={"nav-item" + (archiveView ? " active" : "")} onClick={() => navigate("/?view=archived")}>
        <Icon name="archive" className="nav-ic" size={18}/>
        <span>Archive</span>
        {archivedCount > 0 && (
          <span className={"nav-badge num" + (archiveView ? "" : " muted")}>{archivedCount}</span>
        )}
      </button>

      <div className="nav-label">Current paper</div>
      {current && paperId ? (
        <>
          <div style={{ padding:"0 10px 8px" }}>
            <div style={{ display:"flex", gap:10, alignItems:"center", padding:"9px 11px",
              background:"var(--surface)", borderRadius:11, boxShadow:"var(--sh-sm)",
              border:"1px solid var(--line-2)" }}>
              <div style={{ width:26, height:32, borderRadius:5, flex:"0 0 auto",
                background:"var(--grad-thumb)", border:"1px solid var(--line)",
                display:"grid", placeItems:"center", color:"var(--text-3)" }}>
                <Icon name="doc" size={13}/>
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:12.5, fontWeight:600, lineHeight:1.25,
                  display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                  {paperTitle}
                </div>
              </div>
            </div>
          </div>
          {PAPER_NAV.map((n) => (
            <NavLink key={n.path} to={`/paper/${paperId}/${n.path}`}
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
              {({ isActive }) => (
                <>
                  <Icon name={n.ic} className="nav-ic" size={18}/>
                  <span>{n.label}</span>
                  {n.badge && openCount != null && openCount > 0 && (
                    <span className={"nav-badge num" + (isActive ? "" : " muted")}>{openCount}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </>
      ) : (
        <div style={{ padding:"0 10px 8px" }}>
          <div style={{ padding:"14px 13px", background:"var(--surface)", borderRadius:11,
            border:"1px dashed var(--line-strong)", color:"var(--text-3)" }}>
            <div style={{ fontSize:12.5, fontWeight:600, color:"var(--text-2)", marginBottom:3 }}>
              No paper open
            </div>
            <div style={{ fontSize:11.5, lineHeight:1.45 }}>
              Open one from your dashboard to review it here.
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop:"auto", display:"flex", flexDirection:"column", gap:10 }}>
        <div className="card" style={{ padding:"13px 14px",
          background:"linear-gradient(160deg, var(--accent-soft), var(--surface))",
          border:"1px solid var(--accent-soft-2)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
            <Icon name="bolt" size={15} fill style={{ color:"var(--accent-deep)" }}/>
            <span style={{ fontSize:13, fontWeight:700 }}>Margin Pro</span>
          </div>
          <div style={{ fontSize:11.5, color:"var(--text-2)", lineHeight:1.4 }}>
            Unlimited reviews & literature retrieval across 2.1M papers.
          </div>
        </div>

        <ThemeToggle pref={themePref} onChange={onThemeChange}/>

        <AccountMenu account={account} onSignOut={signOut}
          onOpenSettings={(s) => setSettingsSection(s)}/>
      </div>

      <SettingsModal open={settingsSection != null} section={settingsSection ?? "account"}
        onClose={() => setSettingsSection(null)}
        account={account} onUpdateAccount={signIn}
        onReplayTour={() => { setSettingsSection(null); openTour(); }}
        theme={{ pref: themePref, onChange: onThemeChange }}/>
    </aside>
  );
}

/* avatar circle with initials */
function Avatar({ account, size = 30 }: { account: Account | null; size?: number }) {
  return (
    <div style={{ width:size, height:size, borderRadius:99, background:"var(--avatar-grad)", flex:"0 0 auto",
      display:"grid", placeItems:"center", color:"#fff", fontSize: size * 0.4, fontWeight:700 }}>
      {account ? initials(account.email, account.name) : "?"}
    </div>
  );
}

const MENU_ITEMS: { label: string; ic: IconName; section: SettingsSection }[] = [
  { label: "Account settings", ic: "user", section: "account" },
  { label: "Preferences",      ic: "gear", section: "appearance" },
  { label: "Notifications",    ic: "bell", section: "notifications" },
  { label: "Help & support",   ic: "info", section: "help" },
];

/* clickable account row → popover with settings + logout */
function AccountMenu({ account, onSignOut, onOpenSettings }: {
  account: Account | null; onSignOut: () => void; onOpenSettings: (s: SettingsSection) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const name = account?.name || account?.email.split("@")[0] || "Guest";
  const role = account?.role === "professor" ? "Professor" : "Student";

  return (
    <div className="acct" ref={ref}>
      <AnimatePresence>
        {open && (
          <motion.div className="acct-menu pop"
            initial={{ opacity:0, y:6, scale:0.98 }} animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:6, scale:0.98 }}
            transition={{ type:"spring", stiffness:420, damping:30 }}>
            <div className="menu-head">
              <Avatar account={account} size={38}/>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{name}</div>
                <div style={{ fontSize:11.5, color:"var(--text-3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {account?.email}
                </div>
                <div style={{ fontSize:11, color:"var(--accent-press)", fontWeight:600, marginTop:2 }}>{role}</div>
              </div>
            </div>
            <hr className="menu-sep"/>
            {MENU_ITEMS.map((m) => (
              <button key={m.label} className="menu-item"
                onClick={() => { setOpen(false); onOpenSettings(m.section); }}>
                <Icon name={m.ic} size={17}/> {m.label}
              </button>
            ))}
            <hr className="menu-sep"/>
            <button className="menu-item danger" onClick={() => { setOpen(false); onSignOut(); }}>
              <Icon name="logout" size={17}/> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button className={"acct-btn" + (open ? " on" : "")} onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu" aria-expanded={open} title="Account">
        <Avatar account={account}/>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:12.5, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{name}</div>
          <div style={{ fontSize:11, color:"var(--text-3)" }}>{role}</div>
        </div>
        <Icon name="chevD" size={15} style={{ color:"var(--text-4)", flex:"0 0 auto",
          transform: open ? "rotate(180deg)" : "none", transition:"transform .18s ease" }}/>
      </button>
    </div>
  );
}
