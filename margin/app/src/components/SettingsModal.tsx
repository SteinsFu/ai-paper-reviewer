import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { ThemePref } from "../hooks/useTheme";
import type { Account, UserRole } from "../state/AppState";

export type SettingsSection = "account" | "appearance" | "notifications" | "help";

const NAV: { id: SettingsSection; label: string; ic: IconName }[] = [
  { id: "account",       label: "Account",         ic: "user" },
  { id: "appearance",    label: "Appearance",      ic: "gear" },
  { id: "notifications", label: "Notifications",   ic: "bell" },
  { id: "help",          label: "Help & support",  ic: "info" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SettingsModal({ open, section, onClose, account, onUpdateAccount, onReplayTour, theme }: {
  open: boolean;
  section: SettingsSection;
  onClose: () => void;
  account: Account | null;
  onUpdateAccount: (acc: Account) => void;
  onReplayTour: () => void;
  theme: { pref: ThemePref; onChange: (p: ThemePref) => void };
}) {
  const [active, setActive] = useState<SettingsSection>(section);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  // when (re)opened, jump to the requested section
  useEffect(() => { if (open) setActive(section); }, [open, section]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop"
          initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
          transition={{ duration:0.18 }} onMouseDown={onClose}>
          <motion.div ref={trapRef} className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Settings"
            initial={{ opacity:0, y:14, scale:0.98 }} animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:10, scale:0.98 }}
            transition={{ type:"spring", stiffness:420, damping:32 }}
            onMouseDown={(e) => e.stopPropagation()}>

            <div className="modal-head">
              <div>
                <h2 style={{ fontSize:17, fontWeight:700, letterSpacing:"-0.02em", margin:"0 0 3px" }}>Settings</h2>
                <p style={{ fontSize:13, color:"var(--text-2)", margin:0 }}>Manage your account and workspace</p>
              </div>
              <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close">
                <Icon name="close" size={18}/>
              </button>
            </div>

            <div className="settings">
              <nav className="settings-nav">
                {NAV.map((n) => (
                  <button key={n.id} className={"settings-nav-item" + (active === n.id ? " on" : "")}
                    onClick={() => setActive(n.id)}>
                    <Icon name={n.ic} size={17}/> {n.label}
                  </button>
                ))}
              </nav>
              <div className="settings-panel">
                {active === "account" && <AccountSection account={account} onUpdate={onUpdateAccount}/>}
                {active === "appearance" && <AppearanceSection pref={theme.pref} onChange={theme.onChange}/>}
                {active === "notifications" && <NotificationsSection/>}
                {active === "help" && <HelpSection onReplayTour={onReplayTour}/>}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------- section: account ---------- */
function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:15, fontWeight:700, letterSpacing:"-0.01em" }}>{title}</div>
      {sub && <div style={{ fontSize:12.5, color:"var(--text-3)", marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function AccountSection({ account, onUpdate }: { account: Account | null; onUpdate: (a: Account) => void }) {
  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [role, setRole] = useState<UserRole>(account?.role ?? "student");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(account?.name ?? ""); setEmail(account?.email ?? ""); setRole(account?.role ?? "student");
  }, [account]);

  const dirty = name !== (account?.name ?? "") || email !== (account?.email ?? "") || role !== account?.role;

  function save(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) { setErr("Enter a valid email address."); return; }
    setErr("");
    onUpdate({ email: email.trim(), role, name: name.trim() || undefined });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <form onSubmit={save}>
      <SectionTitle title="Account" sub="Your profile as it appears across Margin." />
      <div className="field">
        <label>Full name</label>
        <input className="input" value={name} placeholder="Your name" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Email</label>
        <input className={"input" + (err ? " err" : "")} type="email" value={email}
          placeholder="you@university.edu" onChange={(e) => setEmail(e.target.value)} />
        {err && <div className="field-err">{err}</div>}
      </div>
      <div className="field">
        <label>Role</label>
        <div className="seg" style={{ width:"100%" }}>
          {(["student","professor"] as UserRole[]).map((r) => (
            <button type="button" key={r} className={role === r ? "on" : ""}
              onClick={() => setRole(r)} style={{ flex:1, position:"relative", textTransform:"capitalize" }}>
              {role === r && (
                <motion.span layoutId="settings-role-thumb" transition={{ type:"spring", stiffness:480, damping:38 }}
                  style={{ position:"absolute", inset:0, background:"var(--surface)", borderRadius:8,
                    boxShadow:"var(--sh-sm)", zIndex:-1 }}/>
              )}
              {r}
            </button>
          ))}
        </div>
      </div>
      <button type="submit" className="btn btn-primary" disabled={!dirty && !saved}
        style={{ opacity: (!dirty && !saved) ? 0.55 : 1 }}>
        {saved ? <><Icon name="check" size={15} strokeWidth={2.4}/> Saved</> : "Save changes"}
      </button>
    </form>
  );
}

/* ---------- section: appearance ---------- */
const THEME_OPTS: { value: ThemePref; label: string; blurb: string; ic: IconName }[] = [
  { value: "light",  label: "Light",  blurb: "Always light",      ic: "sun" },
  { value: "dark",   label: "Dark",   blurb: "Always dark",       ic: "moon" },
  { value: "system", label: "System", blurb: "Match your device", ic: "sliders" },
];
function AppearanceSection({ pref, onChange }: { pref: ThemePref; onChange: (p: ThemePref) => void }) {
  return (
    <>
      <SectionTitle title="Appearance" sub="Choose how Margin looks on this device." />
      <div className="theme-grid">
        {THEME_OPTS.map((o) => {
          const on = pref === o.value;
          return (
            <button key={o.value} className={"theme-opt" + (on ? " on" : "")}
              onClick={() => onChange(o.value)} aria-pressed={on}>
              <span className="theme-ic"><Icon name={o.ic} size={20}/></span>
              <span style={{ fontSize:13.5, fontWeight:600 }}>{o.label}</span>
              <span style={{ fontSize:11.5, color:"var(--text-3)", lineHeight:1.3, textAlign:"center" }}>{o.blurb}</span>
              {on && (
                <span style={{ position:"absolute", top:8, right:8, color:"var(--accent-deep)" }}>
                  <Icon name="checkCircle" size={16} fill/>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize:12, color:"var(--text-3)", margin:"14px 2px 0", lineHeight:1.5 }}>
        Changes apply instantly and are saved to this browser. Tip: press
        {" "}<span className="kbd">⌘</span> <span className="kbd">⇧</span> <span className="kbd">L</span>{" "}
        anywhere to toggle light and dark.
      </p>
    </>
  );
}

/* ---------- section: notifications ---------- */
const NOTIF_KEY = "margin-notifications";
const NOTIF_DEFS: { id: string; label: string; blurb: string; def: boolean }[] = [
  { id: "reviewComplete", label: "Review completed",    blurb: "When an analysis finishes for one of your papers.", def: true },
  { id: "comments",       label: "New reviewer notes",  blurb: "When new notes are added to a paper you follow.",   def: true },
  { id: "mentions",       label: "Mentions & replies",  blurb: "When someone replies to you in the copilot.",       def: true },
  { id: "weeklyDigest",   label: "Weekly digest",       blurb: "A Monday summary of workspace activity.",           def: false },
  { id: "productUpdates", label: "Product updates",     blurb: "Occasional news about new Margin features.",        def: false },
];
function loadNotif(): Record<string, boolean> {
  const base = Object.fromEntries(NOTIF_DEFS.map((d) => [d.id, d.def]));
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) return { ...base, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return base;
}
function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label}
      className={"switch" + (on ? " on" : "")} onClick={onToggle} />
  );
}
function NotificationsSection() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(loadNotif);
  function toggle(id: string) {
    setPrefs((p) => {
      const next = { ...p, [id]: !p[id] };
      try { localStorage.setItem(NOTIF_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }
  return (
    <>
      <SectionTitle title="Notifications" sub="Choose what Margin emails you about." />
      <div>
        {NOTIF_DEFS.map((d, i) => (
          <div key={d.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 2px",
            borderTop: i ? "1px solid var(--line-2)" : "none" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13.5, fontWeight:600 }}>{d.label}</div>
              <div style={{ fontSize:12, color:"var(--text-3)", lineHeight:1.4 }}>{d.blurb}</div>
            </div>
            <Switch on={!!prefs[d.id]} onToggle={() => toggle(d.id)} label={d.label}/>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- section: help ---------- */
const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘","K"], label: "Command palette" },
  { keys: ["⌘","J"], label: "Ask the reviewer" },
  { keys: ["⌘","⇧","L"], label: "Toggle light / dark" },
];
function HelpRow({ ic, title, sub, onClick }: { ic: IconName; title: string; sub: string; onClick?: () => void }) {
  return (
    <button className="menu-item" onClick={onClick}
      style={{ padding:"12px 10px", borderRadius:11, gap:13 }}>
      <span className="role-ic" style={{ width:34, height:34, borderRadius:9, background:"var(--surface-3)", color:"var(--text-2)" }}>
        <Icon name={ic} size={17}/>
      </span>
      <span style={{ minWidth:0, textAlign:"left" }}>
        <span style={{ display:"block", fontSize:13.5, fontWeight:600 }}>{title}</span>
        <span style={{ display:"block", fontSize:12, color:"var(--text-3)" }}>{sub}</span>
      </span>
      <Icon name="arrowR" size={15} style={{ color:"var(--text-4)", marginLeft:"auto" }}/>
    </button>
  );
}
function HelpSection({ onReplayTour }: { onReplayTour: () => void }) {
  return (
    <>
      <SectionTitle title="Help & support" sub="Guides, shortcuts, and a way to reach us." />

      <HelpRow ic="spark" title="Replay welcome tour" sub="See the quick get-started walkthrough again."
        onClick={onReplayTour} />
      <HelpRow ic="book" title="Documentation" sub="Learn how Margin reviews a paper."
        onClick={() => window.open("https://claude.com/claude-code", "_blank", "noopener")} />
      <HelpRow ic="send" title="Contact support" sub="support@margin.app — we reply within a day."
        onClick={() => { window.location.href = "mailto:support@margin.app"; }} />

      <div style={{ fontSize:11.5, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase",
        color:"var(--text-3)", margin:"18px 2px 8px" }}>Keyboard shortcuts</div>
      <div>
        {SHORTCUTS.map((s, i) => (
          <div key={s.label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"9px 4px", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
            <span style={{ fontSize:13.5, color:"var(--text-2)" }}>{s.label}</span>
            <span style={{ display:"flex", gap:4 }}>
              {s.keys.map((k) => <span key={k} className="kbd">{k}</span>)}
            </span>
          </div>
        ))}
      </div>

      <p style={{ fontSize:12, color:"var(--text-4)", marginTop:18, textAlign:"center" }}>
        Margin 1.0 · Prototype
      </p>
    </>
  );
}
