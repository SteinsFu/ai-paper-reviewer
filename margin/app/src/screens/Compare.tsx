import { useMemo } from "react";
import { motion } from "motion/react";
import { Icon } from "../components/Icon";
import { ScoreRing } from "../components/ScoreRing";
import { ScoreBar } from "../components/ScoreBar";
import { CatTag, SevPill } from "../components/Tags";
import { DeltaChip } from "./Analytics";
import { usePaperBundle } from "./PaperLayout";
import { useLibrary, useReviewState } from "../hooks/useReview";
import { reviewStore } from "../services/reviewStore";
import { CATEGORIES, CAT_ORDER } from "../data/mock";
import type { Annotation, PaperVersion, ReviewBundle } from "../services/types";

let versionSeq = 0;

/** Build the next revision from the current review: resolved issues drop out and
    the categories they belonged to nudge up, so the compare shows real progress. */
function synthesize(base: ReviewBundle, resolved: Record<string, boolean>, label: string): PaperVersion {
  const remaining = base.annotations.filter((a) => !resolved[a.id]);
  const resolvedAnnos = base.annotations.filter((a) => resolved[a.id]);
  const scores = { ...base.scores };
  for (const a of resolvedAnnos) scores[a.cat] = Math.min(100, scores[a.cat] + 4);
  const overall = Math.min(100, base.paper.overall + resolvedAnnos.length * 2);
  return {
    id: `sv${Date.now().toString(36)}${(versionSeq++).toString(36)}`,
    label, createdAt: Date.now(), score: overall, openIssues: remaining.length,
    bundle: { ...base, paper: { ...base.paper, overall }, scores, annotations: remaining },
  };
}

export function Compare() {
  const { bundle, paperId } = usePaperBundle();
  const { data: library } = useLibrary();
  const { resolved, versions: storeVersions } = useReviewState(paperId);

  const libPaper = library?.find((p) => p.id === paperId);
  const versions = useMemo<PaperVersion[]>(
    () => [...(libPaper?.versions ?? []), ...(storeVersions ?? [])],
    [libPaper?.versions, storeVersions],
  );

  const resolvedCount = bundle.annotations.filter((a) => resolved[a.id]).length;

  function attachRevision() {
    if (versions.length === 0) {
      // snapshot the current review as the baseline, then the improved revision
      reviewStore.addVersion(paperId, {
        id: `sv${Date.now().toString(36)}base`, label: "v1 · initial review",
        createdAt: Date.now() - 1, score: bundle.paper.overall,
        openIssues: bundle.annotations.length, bundle,
      });
    }
    const prevBundle = versions.length ? versions[versions.length - 1].bundle : bundle;
    const nextNum = versions.length ? versions.length + 1 : 2;
    reviewStore.addVersion(paperId, synthesize(prevBundle, resolved, `v${nextNum} · after your fixes`));
  }

  if (versions.length < 2) {
    return (
      <div className="screen-scroll scroll anim-in">
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "72px 32px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto 18px",
            background: "var(--accent-soft)", color: "var(--accent-deep)", display: "grid", placeItems: "center" }}>
            <Icon name="layers" size={26} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
            No revision to compare yet
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--text-2)", lineHeight: 1.55, margin: "0 auto 22px", maxWidth: 460 }}>
            Resolve some notes in the reader, then attach a revision. Margin snapshots the review so you
            can see exactly how the manuscript improved between versions.
          </p>
          <button className="btn btn-primary btn-lg" onClick={attachRevision} disabled={resolvedCount === 0}
            style={{ opacity: resolvedCount === 0 ? 0.55 : 1 }}>
            <Icon name="layers" size={17} /> Attach revision from current review
          </button>
          <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 12 }}>
            {resolvedCount === 0
              ? "Resolve at least one note to snapshot a revision."
              : `${resolvedCount} resolved ${resolvedCount === 1 ? "note" : "notes"} will be reflected in the new version.`}
          </div>
        </div>
      </div>
    );
  }

  const from = versions[versions.length - 2];
  const to = versions[versions.length - 1];
  const fromIds = new Set(from.bundle.annotations.map((a) => a.id));
  const toIds = new Set(to.bundle.annotations.map((a) => a.id));
  const cleared = from.bundle.annotations.filter((a) => !toIds.has(a.id));
  const introduced = to.bundle.annotations.filter((a) => !fromIds.has(a.id));

  return (
    <div className="screen-scroll scroll anim-in">
      <div style={{ maxWidth: 940, margin: "0 auto", padding: "30px 38px 80px" }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 5px" }}>
            Version comparison
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", margin: 0 }}>
            {from.label} &nbsp;→&nbsp; {to.label}
          </p>
        </div>

        {/* headline: overall health, both versions + delta */}
        <div className="card" style={{ padding: "22px 26px", marginBottom: 16, display: "flex",
          alignItems: "center", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
          <VersionRing label={from.label} value={from.bundle.paper.overall} muted />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Icon name="arrowR" size={22} style={{ color: "var(--text-4)" }} />
            <DeltaChip from={from.bundle.paper.overall} to={to.bundle.paper.overall}
              delta={to.bundle.paper.overall - from.bundle.paper.overall} big />
          </div>
          <VersionRing label={to.label} value={to.bundle.paper.overall} />
        </div>

        {/* per-category deltas */}
        <div className="card" style={{ padding: "20px 24px", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", letterSpacing: "-0.02em" }}>
            Category scores
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            {CAT_ORDER.map((cat) => {
              const C = CATEGORIES[cat];
              const fv = from.bundle.scores[cat] ?? 0;
              const tv = to.bundle.scores[cat] ?? 0;
              const d = tv - fv;
              return (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, width: 150, flex: "0 0 150px" }}>
                    <span className="dot" style={{ background: C.color, width: 8, height: 8 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>{C.label}</span>
                  </div>
                  <ScoreBar value={tv} color={C.color} />
                  <span className="num" style={{ fontSize: 12.5, color: "var(--text-3)", width: 30, textAlign: "right" }}>{fv}</span>
                  <Icon name="arrowR" size={12} style={{ color: "var(--text-4)" }} />
                  <span className="num" style={{ fontSize: 13.5, fontWeight: 700, width: 26, textAlign: "right" }}>{tv}</span>
                  <span className="num" style={{ fontSize: 12.5, fontWeight: 700, width: 34, textAlign: "right",
                    color: d > 0 ? "var(--ok)" : d < 0 ? "var(--critical)" : "var(--text-4)" }}>
                    {d > 0 ? "+" : ""}{d || "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* issue diff */}
        <div className="analytics-two">
          <DiffColumn title="Resolved since last version" tone="ok" icon="check" notes={cleared}
            empty="No issues were cleared between these versions." />
          <DiffColumn title="New in this version" tone="warn" icon="alert" notes={introduced}
            empty="No new issues were introduced." />
        </div>
      </div>
    </div>
  );
}

function VersionRing({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
      <ScoreRing value={value} size={84} stroke={7}
        color={muted ? "var(--text-3)" : "var(--accent-deep)"} sub="HEALTH" />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: muted ? "var(--text-3)" : "var(--text)" }}>{label}</span>
    </motion.div>
  );
}

function DiffColumn({ title, tone, icon, notes, empty }: {
  title: string; tone: "ok" | "warn"; icon: "check" | "alert"; notes: Annotation[]; empty: string;
}) {
  const color = tone === "ok" ? "var(--ok)" : "var(--warn)";
  const soft = tone === "ok" ? "var(--ok-soft)" : "var(--warn-soft)";
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center",
          background: soft, color }}>
          <Icon name={icon} size={15} />
        </span>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>
        <span className="chip num" style={{ marginLeft: "auto", height: 21, background: soft, color }}>{notes.length}</span>
      </div>
      {notes.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-3)", padding: "6px 0", lineHeight: 1.5 }}>{empty}</div>
      ) : (
        <div style={{ display: "grid", gap: 9 }}>
          {notes.map((n) => (
            <div key={n.id} style={{ border: "1px solid var(--line-2)", borderRadius: 11, padding: "10px 12px",
              background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <CatTag cat={n.cat} small />
                <span style={{ marginLeft: "auto" }}><SevPill sev={n.sev} /></span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4 }}>{n.title}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
