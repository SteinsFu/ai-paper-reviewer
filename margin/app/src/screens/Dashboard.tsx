import { useState } from "react";
import type { MouseEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { Icon } from "../components/Icon";
import type { IconName } from "../components/Icon";
import { CountUp } from "../components/CountUp";
import { Segmented } from "../components/Segmented";
import { Skeleton, SkeletonCard } from "../components/Skeleton";
import { StatusPill } from "../components/Tags";
import { ErrorState } from "../components/ErrorState";
import { useLibrary } from "../hooks/useReview";
import { useAppState } from "../state/AppState";
import type { LibraryPaper } from "../services/types";

type Filter = "all" | "in-review" | "done" | "archived";

function paramToFilter(v: string | null): Filter {
  return v === "in-review" || v === "done" || v === "archived" ? v : "all";
}

const EMPTY_COPY: Record<Filter, { title: string; sub: string }> = {
  all:       { title:"Nothing here yet",        sub:"Papers you add will appear here." },
  "in-review":{ title:"No reviews in progress", sub:"Start a new review to see it here." },
  done:      { title:"No completed reviews",    sub:"Reviews you finish will show up here." },
  archived:  { title:"Archive is empty",        sub:"Finished reviews you archive are filed here." },
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function Dashboard() {
  const { data: lib, loading, error, reload, remove, setArchived } = useLibrary();
  const { currentPaperId, setCurrentPaper, account } = useAppState();
  const who = account?.name?.trim() || account?.email.split("@")[0] || "there";
  const [params, setParams] = useSearchParams();
  const filter = paramToFilter(params.get("view"));
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const navigate = useNavigate();

  const changeFilter = (f: Filter) =>
    setParams(f === "all" ? {} : { view: f }, { replace: true });

  function openPaper(p: LibraryPaper) {
    if (p.status === "draft") navigate("/new");
    else navigate(`/paper/${p.id}/reader`);
  }

  // archiving or deleting the focused paper clears the "current paper" pointer
  function clearIfCurrent(id: string) {
    if (id === currentPaperId) setCurrentPaper(null);
  }
  function archivePaper(id: string) { void setArchived(id, true); clearIfCurrent(id); }
  function deletePaper(id: string) { void remove(id); clearIfCurrent(id); }

  if (error && !loading) {
    return (
      <div className="screen-scroll scroll">
        <ErrorState
          title="Couldn't load your workspace"
          message="Your papers didn't load. Check your connection and try again."
          onRetry={reload}
        />
      </div>
    );
  }

  if (loading || !lib) {
    return (
      <div className="screen-scroll scroll">
        <div style={{ maxWidth:1080, margin:"0 auto", padding:"34px 38px 70px" }}>
          <Skeleton w={320} h={30} style={{ marginBottom:10 }}/>
          <Skeleton w={460} h={14} style={{ marginBottom:28 }}/>
          <div className="stat-grid" style={{ marginBottom:30 }}>
            {[0,1,2,3].map((i) => <SkeletonCard key={i} height={96}/>)}
          </div>
          <SkeletonCard height={320}/>
        </div>
      </div>
    );
  }

  // the active workspace excludes archived reviews — those live in their own section
  const active = lib.filter((p) => !p.archived);
  const archivedCount = lib.length - active.length;
  const reviewed = active.filter((p) => p.score != null);
  const avg = reviewed.length
    ? Math.round(reviewed.reduce((s, p) => s + (p.score ?? 0), 0) / reviewed.length) : 0;
  const totalIssues = active.reduce((s, p) => s + p.issues, 0);
  const inReview = active.filter((p) => p.status !== "done").length;

  const stats: { label: string; value: number; ic: IconName; accent?: boolean }[] = [
    { label:"Papers in workspace", value:active.length, ic:"doc" },
    { label:"Avg. health score", value:avg, ic:"bolt", accent:true },
    { label:"Open issues", value:totalIssues, ic:"alert" },
    { label:"Awaiting review", value:inReview, ic:"clock" },
  ];

  const shown = lib.filter((p) =>
    filter === "archived" ? p.archived
    : p.archived ? false
    : filter === "all" ? true
    : filter === "done" ? p.status === "done"
    : p.status !== "done");

  return (
    <div className="screen-scroll scroll anim-in">
      <div style={{ maxWidth:1080, margin:"0 auto", padding:"34px 38px 70px" }}>

        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:26, gap:20 }}>
          <div>
            <h1 style={{ fontSize:32, fontWeight:700, letterSpacing:"-0.03em", margin:"0 0 5px" }}>
              {greeting()}, {who}
            </h1>
            <p style={{ fontSize:15.5, color:"var(--text-2)", margin:0 }}>
              You have {inReview} {inReview === 1 ? "paper" : "papers"} in progress and {totalIssues} open issues across your workspace.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/new")}>
            <Icon name="plus" size={17} strokeWidth={2.2}/> New review
          </button>
        </div>

        {/* Stat cards */}
        <div className="stat-grid" style={{ marginBottom:30 }}>
          {stats.map((s, i) => (
            <motion.div key={s.label} className="card card-hover" style={{ padding:"18px 18px 16px" }}
              initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
              transition={{ delay: i * 0.05, type:"spring", stiffness:380, damping:32 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ fontSize:34, fontWeight:700, letterSpacing:"-0.03em",
                  color: s.accent ? "var(--accent-deep)" : "var(--text)" }}>
                  <CountUp value={s.value}/>
                </div>
                <div style={{ width:30, height:30, borderRadius:9, display:"grid", placeItems:"center",
                  background: s.accent ? "var(--accent-soft)" : "var(--surface-3)",
                  color: s.accent ? "var(--accent-deep)" : "var(--text-2)" }}>
                  <Icon name={s.ic} size={16}/>
                </div>
              </div>
              <div style={{ fontSize:13, color:"var(--text-2)", marginTop:4, fontWeight:500 }}>{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Library */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:13 }}>
          <h2 style={{ fontSize:19, fontWeight:600, margin:0, letterSpacing:"-0.02em" }}>Your papers</h2>
          <Segmented id="dash-filter" value={filter} onChange={changeFilter} options={[
            { value:"all", label:"All" },
            { value:"in-review", label:"In review" },
            { value:"done", label:"Reviewed" },
            { value:"archived", label: archivedCount ? `Archive · ${archivedCount}` : "Archive" },
          ]}/>
        </div>

        <div className="card" style={{ overflow:"hidden", padding:0 }}>
          {shown.length === 0 && (
            <div style={{ textAlign:"center", padding:"54px 20px", color:"var(--text-3)" }}>
              <Icon name={filter === "archived" ? "archive" : "doc"} size={28} style={{ marginBottom:10, opacity:0.5 }}/>
              <div style={{ fontSize:14.5, fontWeight:600, color:"var(--text-2)", marginBottom:4 }}>
                {EMPTY_COPY[filter].title}
              </div>
              <div style={{ fontSize:13 }}>{EMPTY_COPY[filter].sub}</div>
            </div>
          )}
          {shown.map((p, i) => {
            const confirming = confirmId === p.id;
            const isCurrent = p.id === currentPaperId;
            const stop = (e: MouseEvent) => { e.stopPropagation(); };
            return (
            <motion.div key={p.id} layout role="button" tabIndex={0}
              aria-label={`Open review: ${p.title}`}
              onClick={() => openPaper(p)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                  e.preventDefault(); openPaper(p);
                }
              }}
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              transition={{ delay: 0.15 + i * 0.04 }}
              className="dash-row"
              style={{ display:"flex", alignItems:"center", gap:16, width:"100%", textAlign:"left",
                padding:"15px 20px", border:"none", borderTop: i ? "1px solid var(--line-2)" : "none",
                background: isCurrent ? "var(--accent-soft)" : "var(--surface)", transition:"background .15s" }}
              onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = "var(--surface)"; }}>
              <div style={{ width:40, height:50, borderRadius:7, flex:"0 0 auto",
                background:"var(--grad-thumb)", border:"1px solid var(--line)",
                display:"grid", placeItems:"center", color:"var(--text-3)", boxShadow:"var(--sh-sm)" }}>
                <Icon name="doc" size={19}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:3 }}>
                  <span style={{ fontSize:15, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden",
                    textOverflow:"ellipsis", maxWidth:380 }}>{p.title}</span>
                  {isCurrent && <span style={{ fontSize:11, fontWeight:700, color:"var(--accent-press)" }}>· current</span>}
                </div>
                <div style={{ fontSize:12.5, color:"var(--text-3)" }}>
                  {p.authors} · {p.venue}
                </div>
              </div>
              <StatusPill status={p.status}/>
              {p.issues > 0 ? (
                <div className="num" style={{ display:"flex", alignItems:"center", gap:5, fontSize:12.5,
                  color:"var(--text-2)", fontWeight:600, minWidth:62 }}>
                  <Icon name="alert" size={14} style={{ color:"var(--warn)" }}/> {p.issues} issues
                </div>
              ) : <div style={{ minWidth:62 }}/>}
              <div style={{ width:50, textAlign:"right" }}>
                {p.score != null
                  ? <span className="num" style={{ fontSize:18, fontWeight:700, letterSpacing:"-0.02em",
                      color: p.score >= 85 ? "var(--ok)" : p.score >= 70 ? "var(--accent-deep)" : "var(--critical)" }}>{p.score}</span>
                  : <span style={{ fontSize:13, color:"var(--text-4)" }}>—</span>}
              </div>
              <div style={{ fontSize:12, color:"var(--text-3)", minWidth:74, textAlign:"right" }}>{p.updated}</div>

              <div className="row-tail" style={{ minWidth:100 }}>
                {confirming ? (
                  <div className="row-actions forced" style={{ position:"static", transform:"none" }} onClick={stop}>
                    <span style={{ fontSize:12.5, color:"var(--text-2)", fontWeight:600, marginRight:2 }}>Delete?</span>
                    <button className="icon-btn" title="Cancel" aria-label="Cancel delete"
                      style={{ width:"auto", padding:"0 10px", fontSize:12.5, fontWeight:600 }}
                      onClick={(e) => { stop(e); setConfirmId(null); }}>Cancel</button>
                    <button className="icon-btn confirm" title="Delete review" aria-label="Confirm delete"
                      onClick={(e) => { stop(e); setConfirmId(null); deletePaper(p.id); }}>
                      <Icon name="trash" size={15}/> Delete
                    </button>
                  </div>
                ) : (
                  <>
                    <Icon name="chevR" className="row-chev" size={16}/>
                    <div className="row-actions" onClick={stop}>
                      {p.archived ? (
                        <button className="icon-btn" title="Restore to workspace" aria-label="Restore to workspace"
                          onClick={(e) => { stop(e); void setArchived(p.id, false); }}>
                          <Icon name="restore" size={16}/>
                        </button>
                      ) : (
                        <button className="icon-btn" title="Mark done & archive" aria-label="Mark done and archive"
                          onClick={(e) => { stop(e); archivePaper(p.id); }}>
                          <Icon name="archive" size={16}/>
                        </button>
                      )}
                      <button className="icon-btn danger" title="Delete review" aria-label="Delete review"
                        onClick={(e) => { stop(e); setConfirmId(p.id); }}>
                        <Icon name="trash" size={16}/>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          );})}
        </div>
      </div>
    </div>
  );
}
