import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../components/Icon";
import { ScoreRing } from "../components/ScoreRing";
import { ScoreBar } from "../components/ScoreBar";
import { Segmented } from "../components/Segmented";
import { SkeletonCard } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { usePaperBundle } from "./PaperLayout";
import { useVenues, useReviewState } from "../hooks/useReview";
import { estimateAcceptance, matchScore } from "../data/venues";
import { CATEGORIES } from "../data/mock";
import type { Annotation, CategoryId, PublicationVenue, VenueFieldTag } from "../services/types";

type Sort = "match" | "fit" | "chance" | "deadline" | "prestige";

const KIND_LABEL: Record<PublicationVenue["kind"], string> = {
  conference: "Conference", journal: "Journal", workshop: "Workshop",
};

const FIELD_LABEL: Record<VenueFieldTag, string> = {
  hci: "HCI", nlp: "NLP", ml: "ML", ml4h: "ML for Health",
  se: "Software Engineering", haptics: "Haptics",
  cv: "Computer Vision", systems: "Systems", security: "Security", other: "Other",
};

/** days until an ISO deadline, or null for rolling / past */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T23:59:59");
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}
function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function chanceColor(v: number): string {
  return v >= 45 ? "var(--ok)" : v >= 25 ? "var(--accent-deep)" : "var(--warn)";
}

export function Publish() {
  const { bundle, paperId } = usePaperBundle();
  const { data, loading, error, reload } = useVenues(paperId);
  const venues = data?.venues ?? null;
  const primary = data?.primary;
  const secondary = data?.secondary;
  const { resolved, userNotes } = useReviewState(paperId);
  const [sort, setSort] = useState<Sort>("match");
  const overall = bundle.paper.overall;

  // the still-open findings drive the estimate down; resolving them lifts it
  const openIssues = useMemo<Annotation[]>(
    () => [...bundle.annotations, ...userNotes].filter((a) => !resolved[a.id]),
    [bundle.annotations, userNotes, resolved],
  );

  // dominant open-weakness category, for the callout ("mostly Methodology")
  const topWeakness = useMemo<{ cat: CategoryId; count: number } | null>(() => {
    if (openIssues.length === 0) return null;
    const byCat = new Map<CategoryId, number>();
    for (const a of openIssues) byCat.set(a.cat, (byCat.get(a.cat) ?? 0) + 1);
    const [cat, count] = [...byCat.entries()].sort((x, y) => y[1] - x[1])[0];
    return { cat, count };
  }, [openIssues]);

  const ranked = useMemo(() => {
    if (!venues) return [];
    // current chance reflects open issues; potential = if every issue were resolved
    const matchOf = (v: PublicationVenue) => v.match ?? matchScore(v, overall);
    const rows = venues.map((v) => ({
      v,
      chance: estimateAcceptance(v, overall, openIssues),
      potential: estimateAcceptance(v, overall, []),
    }));
    const byDeadline = (x: typeof rows[number]) => {
      const d = daysUntil(x.v.deadline);
      return d == null ? Number.POSITIVE_INFINITY : d < 0 ? Number.POSITIVE_INFINITY - 1 : d;
    };
    const cmp: Record<Sort, (a: typeof rows[number], b: typeof rows[number]) => number> = {
      match: (a, b) => matchOf(b.v) - matchOf(a.v) || b.v.prestige - a.v.prestige,
      fit: (a, b) => b.v.fit - a.v.fit,
      chance: (a, b) => b.chance - a.chance,
      prestige: (a, b) => b.v.prestige - a.v.prestige || b.v.fit - a.v.fit,
      deadline: (a, b) => byDeadline(a) - byDeadline(b),
    };
    return [...rows].sort(cmp[sort]);
  }, [venues, overall, openIssues, sort]);

  const bestFit = useMemo(() => venues && [...venues].sort((a, b) => b.fit - a.fit)[0], [venues]);
  const bestOdds = useMemo(() => {
    if (!venues) return null;
    return [...venues].map((v) => ({ v, c: estimateAcceptance(v, overall, openIssues) }))
      .sort((a, b) => b.c - a.c)[0];
  }, [venues, overall, openIssues]);

  if (error && !loading) {
    return (
      <div className="screen-scroll scroll">
        <ErrorState title="Couldn't load venue suggestions"
          message="The recommendations didn't come through. Try again." onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="screen-scroll scroll anim-in">
      <div style={{ maxWidth: 940, margin: "0 auto", padding: "30px 38px 80px" }}>

        <div style={{ marginBottom: 18 }}>
          <div className="no-print" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5,
            fontWeight: 600, color: "var(--accent-press)", background: "var(--accent-soft)",
            padding: "4px 12px", borderRadius: 99, marginBottom: 12 }}>
            <Icon name="target" size={14} /> Where to publish
          </div>
          <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 6px" }}>
            Suggested venues for this paper
          </h1>
          {!loading && primary && primary !== "other" && (
            <div className="chip" style={{ height: 24, marginBottom: 10, fontWeight: 600 }}>
              Tagged as {FIELD_LABEL[primary]}
              {secondary && secondary !== "other" ? ` + ${FIELD_LABEL[secondary]}` : ""}
            </div>
          )}
          <p style={{ fontSize: 14.5, color: "var(--text-2)", margin: 0, lineHeight: 1.55, maxWidth: 660 }}>
            Conferences and journals that align with <em>{bundle.paper.title}</em>, ranked by how well this paper's
            score matches each venue's bar. Each estimate weighs the paper's health of{" "}
            <span className="num" style={{ fontWeight: 700, color: "var(--text)" }}>{overall}/100</span>, the venue's
            selectivity, and the <strong style={{ color: "var(--text)" }}>specific issues still open</strong> in the
            review — resolving findings in the reader raises the odds.
          </p>
        </div>

        {/* open-weaknesses callout — the estimates react to these */}
        {!loading && ranked.length > 0 && openIssues.length > 0 && topWeakness && (
          <div className="card" style={{ padding: "13px 16px", marginBottom: 16, display: "flex",
            alignItems: "center", gap: 12, background: "var(--warn-soft)", border: "1px solid var(--warn)" }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, flex: "0 0 auto", display: "grid",
              placeItems: "center", background: "var(--warn)", color: "#fff" }}>
              <Icon name="alert" size={16} />
            </span>
            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.45 }}>
              <strong>{openIssues.length} open {openIssues.length === 1 ? "issue is" : "issues are"}</strong> holding
              these estimates back{" "}
              <span style={{ color: "var(--text-2)" }}>
                (mostly {CATEGORIES[topWeakness.cat].label.toLowerCase()}). Resolve or apply fixes in the reader — venues
                that scrutinize {CATEGORIES[topWeakness.cat].label.toLowerCase()} respond the most.
              </span>
            </div>
          </div>
        )}

        {/* insight banner */}
        {!loading && bestFit && bestOdds && (
          <div className="card" style={{ padding: "14px 18px", marginBottom: 18, display: "flex",
            gap: 22, flexWrap: "wrap", alignItems: "center" }}>
            <Insight ic="target" label="Strongest fit" value={bestFit.name}
              sub={`${bestFit.fit}% topical match`} />
            <div style={{ width: 1, alignSelf: "stretch", background: "var(--line-2)" }} />
            <Insight ic="spark" label="Best odds" value={bestOdds.v.name}
              sub={`~${bestOdds.c}% estimated acceptance`} />
            <div style={{ width: 1, alignSelf: "stretch", background: "var(--line-2)" }} />
            <Insight ic="doc" label="Options found" value={String(venues?.length ?? 0)}
              sub="conferences & journals" />
          </div>
        )}

        {(loading || ranked.length > 0) && (
          <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 13, gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: "-0.02em", color: "var(--text-2)" }}>
              {loading ? "Finding venues…" : `${ranked.length} venues`}
            </h2>
            {!loading && (
              <Segmented id="venue-sort" value={sort} onChange={(v) => setSort(v as Sort)} options={[
                { value: "match", label: "Best match" },
                { value: "fit", label: "Best fit" },
                { value: "chance", label: "Best odds" },
                { value: "deadline", label: "Deadline" },
                { value: "prestige", label: "Prestige" },
              ]} />
            )}
          </div>
        )}

        {loading ? (
          <div style={{ display: "grid", gap: 14 }}>
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} height={150} />)}
          </div>
        ) : ranked.length === 0 ? (
          <div className="card" style={{ padding: "28px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>
              No catalog match for this topic.
            </div>
            <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.5, margin: 0 }}>
              Venue suggestions cover CS (ML, NLP, HCI, SE, CV, systems, security, haptics). This paper landed outside that set.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {ranked.map(({ v, chance, potential }, i) => (
              <VenueCard key={v.id} v={v} chance={chance} potential={potential} index={i} />
            ))}
          </div>
        )}

        <p className="no-print" style={{ fontSize: 12, color: "var(--text-4)", marginTop: 22, lineHeight: 1.5, textAlign: "center" }}>
          Acceptance estimates are directional guidance, not guarantees. Always confirm deadlines and scope on each
          venue's official page before submitting.
        </p>
      </div>
    </div>
  );
}

function Insight({ ic, label, value, sub }: { ic: "target" | "spark" | "doc"; label: string; value: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, flex: "0 0 auto", display: "grid", placeItems: "center",
        background: "var(--accent-soft)", color: "var(--accent-deep)" }}>
        <Icon name={ic} size={17} fill={ic === "spark"} />
      </span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--text-3)" }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>{sub}</div>
      </div>
    </div>
  );
}

function PrestigeStars({ n }: { n: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }} title={`Esteem ${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={13} fill={i <= n}
          style={{ color: i <= n ? "var(--accent)" : "var(--text-4)" }} />
      ))}
    </span>
  );
}

function DeadlineChip({ iso, note }: { iso: string | null; note?: string }) {
  const days = daysUntil(iso);
  let label: string, color: string, soft: string, sub: string | undefined;
  if (iso == null) {
    const rolling = /rolling/i.test(note ?? "");
    label = rolling ? "Rolling" : "Next cycle";
    color = "var(--text-2)"; soft = "var(--surface-3)";
    sub = note ?? "No fixed deadline";
  } else if (days == null || days < 0) {
    label = "Next cycle"; color = "var(--text-2)"; soft = "var(--surface-3)"; sub = `Last: ${fmtDate(iso)}`;
  } else {
    sub = fmtDate(iso);
    if (days <= 21) { label = `${days}d left`; color = "var(--critical)"; soft = "var(--critical-soft)"; }
    else if (days <= 60) { label = `${days}d left`; color = "var(--warn)"; soft = "var(--warn-soft)"; }
    else { label = `${days}d left`; color = "var(--ok)"; soft = "var(--ok-soft)"; }
    if (note) sub = `${fmtDate(iso)} · ${note}`;
  }
  return (
    <div style={{ textAlign: "right", flex: "0 0 auto" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 99,
        background: soft, color }}>
        <Icon name="clock" size={13} />
        <span className="num" style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</span>
      </div>
      {sub && <div className="num" style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function VenueCard({ v, chance, potential, index }: {
  v: PublicationVenue; chance: number; potential: number; index: number;
}) {
  const uplift = potential - chance; // how much the open issues are costing you here
  return (
    <motion.div className="card" style={{ padding: "18px 20px" }}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), type: "spring", stiffness: 380, damping: 32 }}>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }} className="venue-row">

        {/* estimated chance ring + potential-if-resolved uplift */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: "0 0 auto" }}>
          <ScoreRing value={chance} size={72} stroke={6} color={chanceColor(chance)} sub="CHANCE" />
          {uplift > 0 ? (
            <span title={`Up to ~${potential}% if you resolve all open issues`}
              style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700,
                color: "var(--ok)", background: "var(--ok-soft)", padding: "2px 7px", borderRadius: 99 }}>
              <Icon name="chevD" size={11} style={{ transform: "rotate(180deg)" }} />
              <span className="num">up to {potential}%</span>
            </span>
          ) : (
            <span style={{ fontSize: 10.5, color: "var(--text-4)", fontWeight: 600 }}>estimated</span>
          )}
        </div>

        {/* body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span className="chip" style={{ height: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.03em", background: "var(--surface-3)", color: "var(--text-2)" }}>
              {KIND_LABEL[v.kind]}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{v.name}</span>
            <PrestigeStars n={v.prestige} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-press)" }}>{v.tierLabel}</span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 3 }}>
            {v.fullName}{v.location ? ` · ${v.location}` : ""}
          </div>

          <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.45, marginTop: 8,
            display: "flex", gap: 7 }}>
            <Icon name="spark" size={14} fill style={{ color: "var(--accent-deep)", flex: "0 0 auto", marginTop: 1 }} />
            <span><strong style={{ fontWeight: 600, color: "var(--text)" }}>Esteem:</strong> {v.esteem}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, marginTop: 7 }}>
            {v.rationale}
          </div>

          {/* fit + meta */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 190, flex: "1 1 190px" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", whiteSpace: "nowrap" }}>Topical fit</span>
              <ScoreBar value={v.fit} color="var(--accent-deep)" />
              <span className="num" style={{ fontSize: 12.5, fontWeight: 700, width: 34, textAlign: "right" }}>{v.fit}%</span>
            </div>
            <Meta label="Accept rate" value={`${v.acceptanceRate}%`} />
            {v.h5 > 0 && <Meta label="h5-index" value={String(v.h5)} />}
          </div>
        </div>

        {/* deadline + link */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12, flex: "0 0 auto" }}
          className="venue-side">
          <DeadlineChip iso={v.deadline} note={v.deadlineNote} />
          <a className="btn btn-sm" href={v.url} target="_blank" rel="noopener noreferrer">
            View venue <Icon name="external" size={14} />
          </a>
        </div>
      </div>
    </motion.div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
      <span className="num" style={{ fontSize: 14, fontWeight: 700 }}>{value}</span>
      <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>{label}</span>
    </div>
  );
}
