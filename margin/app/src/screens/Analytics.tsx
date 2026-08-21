import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Icon } from "../components/Icon";
import type { IconName } from "../components/Icon";
import { CountUp } from "../components/CountUp";
import { ScoreBar } from "../components/ScoreBar";
import { Skeleton, SkeletonCard } from "../components/Skeleton";
import { useAnalytics } from "../hooks/useReview";
import type { CategoryStat, SeverityStat, RevisionStat } from "../hooks/useReview";
import { CATEGORIES, SEVERITY } from "../data/mock";

const spring = { type: "spring" as const, stiffness: 380, damping: 32 };

export function Analytics() {
  const a = useAnalytics();

  if (a.loading) {
    return (
      <div className="screen-scroll scroll">
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "34px 38px 70px" }}>
          <Skeleton w={280} h={30} style={{ marginBottom: 10 }} />
          <Skeleton w={420} h={14} style={{ marginBottom: 28 }} />
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} height={96} />)}
          </div>
          <SkeletonCard height={300} />
        </div>
      </div>
    );
  }

  const stats: { label: string; value: number; ic: IconName; accent?: boolean; suffix?: string }[] = [
    { label: "Papers reviewed", value: a.papersReviewed, ic: "doc" },
    { label: "Avg. health score", value: a.avgOverall, ic: "bolt", accent: true },
    { label: "Open issues", value: a.openNotes, ic: "alert" },
    { label: "Your own notes", value: a.userNoteCount, ic: "pen" },
  ];
  const resolvedPct = a.totalNotes ? Math.round((a.resolvedNotes / a.totalNotes) * 100) : 0;

  return (
    <div className="screen-scroll scroll anim-in">
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "34px 38px 70px" }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 5px" }}>
            Workspace analytics
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: 0 }}>
            Patterns across {a.papersReviewed} reviewed {a.papersReviewed === 1 ? "paper" : "papers"} — where
            your manuscripts are strong, and what keeps coming up.
          </p>
        </div>

        {/* stat tiles */}
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          {stats.map((s, i) => (
            <motion.div key={s.label} className="card" style={{ padding: "18px 18px 16px" }}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, ...spring }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em",
                  color: s.accent ? "var(--accent-deep)" : "var(--text)" }}>
                  <CountUp value={s.value} />
                </div>
                <div style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center",
                  background: s.accent ? "var(--accent-soft)" : "var(--surface-3)",
                  color: s.accent ? "var(--accent-deep)" : "var(--text-2)" }}>
                  <Icon name={s.ic} size={16} />
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </motion.div>
          ))}
        </div>

        {a.papersReviewed === 0 ? (
          <div className="card" style={{ padding: "54px 20px", textAlign: "center", color: "var(--text-3)" }}>
            <Icon name="grid" size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>
              Nothing to chart yet
            </div>
            <div style={{ fontSize: 13 }}>Review a paper or two and your workspace trends will appear here.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <CategoryScores stats={a.categoryStats} n={a.papersReviewed} />
            <div className="analytics-two">
              <SeverityBreakdown stats={a.severityStats} resolvedPct={resolvedPct}
                total={a.totalNotes} resolved={a.resolvedNotes} />
              <CategoryIssues stats={a.categoryStats} />
            </div>
            {a.revisions.length > 0 && <Revisions revisions={a.revisions} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>{title}</h2>
        {hint && <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function scoreColor(v: number) {
  return v >= 85 ? "var(--ok)" : v >= 70 ? "var(--accent-deep)" : "var(--critical)";
}

/* average score per category — magnitude, so horizontal bars with direct labels */
function CategoryScores({ stats, n }: { stats: CategoryStat[]; n: number }) {
  return (
    <Panel title="Average score by category" hint={`mean across ${n} ${n === 1 ? "paper" : "papers"}`}>
      <div style={{ display: "grid", gap: 12 }}>
        {stats.map((s) => {
          const C = CATEGORIES[s.cat];
          return (
            <div key={s.cat} style={{ display: "flex", alignItems: "center", gap: 12 }}
              title={`${C.label}: avg ${s.avg}/100 · ${s.issues} ${s.issues === 1 ? "note" : "notes"}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, width: 150, flex: "0 0 150px" }}>
                <span className="dot" style={{ background: C.color, width: 8, height: 8 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>{C.label}</span>
              </div>
              <ScoreBar value={s.avg} color={C.color} />
              <span className="num" style={{ fontSize: 13.5, fontWeight: 700, width: 34, textAlign: "right",
                color: scoreColor(s.avg) }}>{s.avg}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* issues by severity — open vs resolved, a reserved status palette (with labels) */
function SeverityBreakdown({ stats, resolvedPct, total, resolved }: {
  stats: SeverityStat[]; resolvedPct: number; total: number; resolved: number;
}) {
  const max = Math.max(1, ...stats.map((s) => s.total));
  return (
    <Panel title="Issues by severity" hint={`${resolved}/${total} resolved · ${resolvedPct}%`}>
      <div style={{ display: "grid", gap: 14 }}>
        {stats.map((s) => {
          const S = SEVERITY[s.sev];
          return (
            <div key={s.sev} title={`${S.label}: ${s.open} open, ${s.resolved} resolved`}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: S.color }} />
                  {S.label}
                </span>
                <span className="num" style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                  <span style={{ color: "var(--text)", fontWeight: 700 }}>{s.open}</span> open · {s.resolved} done
                </span>
              </div>
              {/* stacked open|resolved with a 2px surface gap between fills */}
              <div style={{ display: "flex", height: 9, gap: 2 }}>
                <div style={{ width: `${(s.open / max) * 100}%`, background: S.color, borderRadius: 3,
                  transition: "width 1s cubic-bezier(.22,.61,.36,1)" }} />
                <div style={{ width: `${(s.resolved / max) * 100}%`, background: S.soft, borderRadius: 3,
                  transition: "width 1s cubic-bezier(.22,.61,.36,1)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* how many notes each category attracted — magnitude bars */
function CategoryIssues({ stats }: { stats: CategoryStat[] }) {
  const ranked = [...stats].filter((s) => s.issues > 0).sort((x, y) => y.issues - x.issues);
  const max = Math.max(1, ...ranked.map((s) => s.issues));
  return (
    <Panel title="Where issues cluster" hint="notes per category">
      {ranked.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-3)", padding: "8px 0" }}>No notes recorded yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 11 }}>
          {ranked.map((s) => {
            const C = CATEGORIES[s.cat];
            return (
              <div key={s.cat} style={{ display: "flex", alignItems: "center", gap: 12 }}
                title={`${C.label}: ${s.issues} ${s.issues === 1 ? "note" : "notes"}`}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", width: 130, flex: "0 0 130px" }}>
                  {C.label}
                </span>
                <div style={{ flex: 1, height: 9, borderRadius: 99, background: "var(--track)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(s.issues / max) * 100}%`, background: C.color,
                    borderRadius: 99, transition: "width 1s cubic-bezier(.22,.61,.36,1)" }} />
                </div>
                <span className="num" style={{ fontSize: 13, fontWeight: 700, width: 22, textAlign: "right" }}>
                  {s.issues}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* v1 → v2 score movement — polarity, so signed deltas with up/down tone */
function Revisions({ revisions }: { revisions: RevisionStat[] }) {
  return (
    <Panel title="Revision progress" hint="score change between versions">
      <div style={{ display: "grid", gap: 18 }}>
        {revisions.map((r) => (
          <div key={r.paperId}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden",
                  textOverflow: "ellipsis" }}>{r.paperTitle}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>{r.fromLabel} → {r.toLabel}</div>
              </div>
              <DeltaChip from={r.overallFrom} to={r.overallTo} delta={r.overallDelta} big />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {r.catDeltas.filter((d) => d.delta !== 0).map((d) => (
                <span key={d.cat} className="chip" style={{ gap: 6,
                  background: "var(--surface-2)", border: "1px solid var(--line-2)" }}>
                  <span className="dot" style={{ background: CATEGORIES[d.cat].color, width: 7, height: 7 }} />
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>{CATEGORIES[d.cat].label}</span>
                  <span className="num" style={{ fontSize: 12, fontWeight: 700,
                    color: d.delta > 0 ? "var(--ok)" : "var(--critical)" }}>
                    {d.delta > 0 ? "+" : ""}{d.delta}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function DeltaChip({ from, to, delta, big }: { from: number; to: number; delta: number; big?: boolean }) {
  const up = delta > 0, flat = delta === 0;
  const color = flat ? "var(--text-3)" : up ? "var(--ok)" : "var(--critical)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
      <span className="num" style={{ fontSize: big ? 15 : 13, color: "var(--text-3)", fontWeight: 600 }}>{from}</span>
      <Icon name="arrowR" size={14} style={{ color: "var(--text-4)" }} />
      <span className="num" style={{ fontSize: big ? 20 : 15, fontWeight: 700, color: scoreColor(to) }}>{to}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 99,
        background: flat ? "var(--surface-3)" : up ? "var(--ok-soft)" : "var(--critical-soft)", color }}>
        <Icon name={flat ? "arrowR" : up ? "chevD" : "chevD"} size={12}
          style={{ transform: up ? "rotate(180deg)" : "none" }} />
        <span className="num" style={{ fontSize: 12.5, fontWeight: 700 }}>{up ? "+" : ""}{delta}</span>
      </span>
    </span>
  );
}
