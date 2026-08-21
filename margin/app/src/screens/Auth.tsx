import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../components/Icon";
import type { IconName } from "../components/Icon";
import { useAppState } from "../state/AppState";
import type { Account, UserRole } from "../state/AppState";

type Mode = "choice" | "login" | "register" | "forgot";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: { id: UserRole; label: string; blurb: string; ic: IconName }[] = [
  { id: "student",   label: "Student",   blurb: "Get reviewer-grade feedback on your own drafts.", ic: "gradCap" },
  { id: "professor", label: "Professor", blurb: "Review submissions and mentor with structured reports.", ic: "user" },
];

const spring = { type: "spring" as const, stiffness: 380, damping: 32 };
/** derive display initials from a name or email local-part */
function initials(email: string, name?: string): string {
  const base = (name?.trim() || email.split("@")[0] || "").replace(/[._-]+/g, " ").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

export function Auth({ theme }: { theme: { resolved: "light" | "dark"; toggle: () => void } }) {
  const { signIn } = useAppState();
  const [mode, setMode] = useState<Mode>("choice");
  // login state
  const [role, setRole] = useState<UserRole | null>(null);

  return (
    <div className="auth-wrap">
      <button className="icon-btn" onClick={theme.toggle}
        title="Toggle theme" aria-label="Toggle theme"
        style={{ position:"fixed", top:18, right:18, width:38, height:38 }}>
        <Icon name={theme.resolved === "dark" ? "sun" : "moon"} size={18}/>
      </button>

      <motion.div className="auth-card"
        initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={spring}>
        <div className="auth-head">
          <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
            <div className="brand-mark" style={{ width:46, height:46, borderRadius:14 }}/>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {mode === "choice" && (
            <Step key="choice">
              <Head title="Welcome to Margin"
                sub="Your AI peer-review copilot for academic papers." />
              <button className="btn btn-primary btn-full" onClick={() => { setRole(null); setMode("login"); }}>
                Log in
              </button>
              <div style={{ height:11 }}/>
              <button className="btn btn-full" onClick={() => setMode("register")}>
                Create an account
              </button>
              <p style={{ fontSize:12, color:"var(--text-3)", textAlign:"center", marginTop:20, lineHeight:1.5 }}>
                Margin assists human judgment — it never replaces it.
              </p>
            </Step>
          )}

          {mode === "login" && !role && (
            <Step key="login-role">
              <Head title="Log in" sub="First, tell us who you are." />
              {ROLES.map((r) => (
                <button key={r.id} className="role-card" onClick={() => setRole(r.id)}>
                  <span className="role-ic"><Icon name={r.ic} size={22}/></span>
                  <span style={{ minWidth:0 }}>
                    <span style={{ display:"block", fontSize:15, fontWeight:600 }}>{r.label}</span>
                    <span style={{ display:"block", fontSize:12.5, color:"var(--text-3)", lineHeight:1.4 }}>{r.blurb}</span>
                  </span>
                  <Icon name="chevR" size={17} style={{ color:"var(--text-4)", marginLeft:"auto", flex:"0 0 auto" }}/>
                </button>
              ))}
              <BackRow onClick={() => setMode("choice")} label="Back" />
              <SwitchLine text="Don't have an account?" cta="Create one"
                onClick={() => setMode("register")} />
            </Step>
          )}

          {mode === "login" && role && (
            <LoginForm key="login-form" role={role}
              onBack={() => setRole(null)}
              onForgot={() => setMode("forgot")}
              onRegister={() => setMode("register")}
              onSubmit={(email) => signIn({ email, role })} />
          )}

          {mode === "register" && (
            <RegisterForm key="register"
              onBack={() => setMode("choice")}
              onLogin={() => { setRole(null); setMode("login"); }}
              onSubmit={(acc) => signIn(acc)} />
          )}

          {mode === "forgot" && (
            <ForgotForm key="forgot" onBack={() => setMode("login")} />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ---------- shared presentational bits ---------- */
function Step({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-14 }}
      transition={{ duration:0.2, ease:[0.22,0.61,0.36,1] }}>
      {children}
    </motion.div>
  );
}
function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ textAlign:"center", marginBottom:20 }}>
      <h1 className="auth-title">{title}</h1>
      <p className="auth-sub">{sub}</p>
    </div>
  );
}
function BackRow({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="auth-link" onClick={onClick}
      style={{ display:"inline-flex", alignItems:"center", gap:5, marginTop:16, color:"var(--text-2)" }}>
      <Icon name="chevL" size={15}/> {label}
    </button>
  );
}
function SwitchLine({ text, cta, onClick }: { text: string; cta: string; onClick: () => void }) {
  return (
    <p style={{ fontSize:13, color:"var(--text-2)", textAlign:"center", marginTop:18 }}>
      {text} <button className="auth-link" onClick={onClick}>{cta}</button>
    </p>
  );
}
function PasswordField({ label, value, onChange, err, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  err?: string; placeholder?: string; hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-wrap">
        <input className={"input" + (err ? " err" : "")} type={show ? "text" : "password"}
          value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          style={{ paddingRight:44 }} />
        <button type="button" className="input-eye" onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"} tabIndex={-1}>
          <Icon name={show ? "eyeOff" : "eye"} size={17}/>
        </button>
      </div>
      {err ? <div className="field-err">{err}</div>
        : hint ? <div style={{ fontSize:12, color:"var(--text-3)", marginTop:5 }}>{hint}</div> : null}
    </div>
  );
}

/* ---------- login credentials ---------- */
function LoginForm({ role, onBack, onForgot, onRegister, onSubmit }: {
  role: UserRole; onBack: () => void; onForgot: () => void; onRegister: () => void;
  onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [errs, setErrs] = useState<{ email?: string; pw?: string }>({});
  const roleMeta = ROLES.find((r) => r.id === role)!;

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errs = {};
    if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    if (!pw) next.pw = "Enter your password.";
    setErrs(next);
    if (Object.keys(next).length === 0) onSubmit(email.trim());
  }

  return (
    <Step key="login-form">
      <Head title="Welcome back" sub="Log in to your Margin workspace." />
      <div className="chip" style={{ marginBottom:16 }}>
        <span className="role-ic" style={{ width:22, height:22, borderRadius:7 }}>
          <Icon name={roleMeta.ic} size={13}/>
        </span>
        Signing in as {roleMeta.label}
        <button className="auth-link" style={{ marginLeft:6, fontSize:12.5 }} onClick={onBack}>change</button>
      </div>

      <form onSubmit={submit} noValidate>
        <div className="field">
          <label>Email</label>
          <input className={"input" + (errs.email ? " err" : "")} type="email" autoComplete="email"
            value={email} placeholder="you@university.edu" onChange={(e) => setEmail(e.target.value)} autoFocus />
          {errs.email && <div className="field-err">{errs.email}</div>}
        </div>

        <PasswordField label="Password" value={pw} onChange={setPw} err={errs.pw} placeholder="••••••••" />

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", margin:"2px 0 18px" }}>
          <label className="auth-check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember me
          </label>
          <button type="button" className="auth-link" style={{ fontSize:13 }} onClick={onForgot}>
            Forgot your password?
          </button>
        </div>

        <button type="submit" className="btn btn-primary btn-full">Log in</button>
      </form>

      <BackRow onClick={onBack} label="Back" />
      <SwitchLine text="Don't have an account?" cta="Create one" onClick={onRegister} />
    </Step>
  );
}

/* ---------- register ---------- */
function RegisterForm({ onBack, onLogin, onSubmit }: {
  onBack: () => void; onLogin: () => void; onSubmit: (acc: Account) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [agree, setAgree] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    if (pw.length < 8) next.pw = "Use at least 8 characters.";
    if (pw2 !== pw) next.pw2 = "Passwords don't match.";
    if (!agree) next.agree = "Please accept the terms to continue.";
    setErrs(next);
    if (Object.keys(next).length === 0) {
      onSubmit({ email: email.trim(), role, name: name.trim() || undefined });
    }
  }

  return (
    <Step key="register">
      <Head title="Create your account" sub="Start reviewing smarter in a minute." />
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label>Full name</label>
          <input className="input" value={name} placeholder="Dr. Jordan Lin"
            autoComplete="name" onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Email</label>
          <input className={"input" + (errs.email ? " err" : "")} type="email" autoComplete="email"
            value={email} placeholder="you@university.edu" onChange={(e) => setEmail(e.target.value)} />
          {errs.email && <div className="field-err">{errs.email}</div>}
        </div>

        <PasswordField label="Password" value={pw} onChange={setPw} err={errs.pw}
          placeholder="Create a password" hint="At least 8 characters." />
        <PasswordField label="Confirm password" value={pw2} onChange={setPw2} err={errs.pw2}
          placeholder="Re-enter your password" />

        <div className="field">
          <label>I am a…</label>
          <div className="seg" style={{ width:"100%" }}>
            {ROLES.map((r) => (
              <button type="button" key={r.id} className={role === r.id ? "on" : ""}
                onClick={() => setRole(r.id)} style={{ flex:1, position:"relative" }}>
                {role === r.id && (
                  <motion.span layoutId="reg-role-thumb" transition={{ type:"spring", stiffness:480, damping:38 }}
                    style={{ position:"absolute", inset:0, background:"var(--surface)", borderRadius:8,
                      boxShadow:"var(--sh-sm)", zIndex:-1 }}/>
                )}
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <label className="auth-check" style={{ margin:"4px 0 16px", alignItems:"flex-start" }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
            style={{ marginTop:2 }} />
          <span>I agree to the <span className="auth-link">Terms of Service</span> and <span className="auth-link">Privacy Policy</span>.</span>
        </label>
        {errs.agree && <div className="field-err" style={{ marginTop:-8, marginBottom:12 }}>{errs.agree}</div>}

        <button type="submit" className="btn btn-primary btn-full">Create account</button>
      </form>

      <BackRow onClick={onBack} label="Back" />
      <SwitchLine text="Already have an account?" cta="Log in" onClick={onLogin} />
    </Step>
  );
}

/* ---------- forgot password ---------- */
function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) { setErr("Enter a valid email address."); return; }
    setErr(""); setSent(true);
  }

  if (sent) {
    return (
      <Step key="forgot-sent">
        <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
          <span className="role-ic" style={{ width:48, height:48, background:"var(--ok-soft)", color:"var(--ok)" }}>
            <Icon name="checkCircle" size={26}/>
          </span>
        </div>
        <Head title="Check your inbox"
          sub={`If an account exists for ${email}, we've sent a link to reset your password.`} />
        <button className="btn btn-primary btn-full" onClick={onBack}>Back to log in</button>
      </Step>
    );
  }

  return (
    <Step key="forgot">
      <Head title="Reset your password"
        sub="Enter your email and we'll send you a reset link." />
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label>Email</label>
          <input className={"input" + (err ? " err" : "")} type="email" autoComplete="email"
            value={email} placeholder="you@university.edu" onChange={(e) => setEmail(e.target.value)} autoFocus />
          {err && <div className="field-err">{err}</div>}
        </div>
        <button type="submit" className="btn btn-primary btn-full">Send reset link</button>
      </form>
      <BackRow onClick={onBack} label="Back to log in" />
    </Step>
  );
}

export { initials };
