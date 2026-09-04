/* ============================================================
   Margin — publication venue recommendations (mock data)
   For each reviewed paper, a curated set of conferences & journals
   that align with its topic, with realistic prestige, selectivity,
   deadlines and links. The per-paper acceptance estimate is computed
   from the paper's health score, the venue's selectivity and the fit
   (estimateAcceptance) so stronger reviews surface better odds.
   Screens reach this through the service layer (api.getVenues).
   ============================================================ */
import type { Annotation, CategoryId, PublicationVenue } from "../services/types";

/* How much an unresolved finding costs, by severity and by category. Substance
   issues (methodology, logic, novelty) weigh more than surface ones (writing,
   formatting) — reviewers forgive typos far sooner than a flawed study. */
const SEV_WEIGHT: Record<string, number> = { critical: 3, moderate: 1.4, minor: 0.5 };
const CAT_WEIGHT: Record<CategoryId, number> = {
  method: 1.3, logic: 1.2, novelty: 1.3, structure: 0.9, citation: 1.0, writing: 0.7, format: 0.5,
};
/* Which weaknesses a venue's community is toughest on — a methods flaw sinks a
   NeurIPS/ICSE submission harder than a writing nit sinks a design venue. */
const VENUE_FOCUS: Record<string, CategoryId[]> = {
  "Machine Learning": ["method", "logic", "novelty"],
  "Machine Learning for Health": ["method", "logic"],
  "Software Engineering": ["method", "logic", "structure"],
  "Medical Informatics": ["method", "citation"],
  "Natural Language Processing": ["method", "novelty"],
  "Human-Computer Interaction": ["method", "writing", "structure"],
  "HCI Systems": ["novelty", "method"],
  "Interaction Design": ["structure", "writing"],
  "Intelligent User Interfaces": ["novelty", "method"],
  "Haptics": ["method", "novelty"],
};

/** Weighted cost of a paper's still-open findings for a specific venue — the
    sum of each issue's severity×category weight, boosted when the issue lands in
    a category this venue scrutinizes, then amplified by the venue's selectivity. */
export function weaknessPenalty(venue: PublicationVenue, openIssues: Annotation[]): number {
  const focus = VENUE_FOCUS[venue.field] ?? [];
  let pts = 0;
  for (const a of openIssues) {
    let w = (SEV_WEIGHT[a.sev] ?? 0.5) * (CAT_WEIGHT[a.cat] ?? 1);
    if (focus.includes(a.cat)) w *= 1.4;   // this venue cares especially about this
    pts += w;
  }
  const rigor = 0.7 + venue.prestige * 0.12; // pickier venues punish weaknesses more
  return pts * rigor;
}

/** Estimated chance THIS paper is accepted at a venue: the venue's base
    acceptance rate, lifted by topical fit and the paper's review health, then
    pulled DOWN by the specific weaknesses still open in the review. Resolving
    (or applying fixes to) findings removes them from `openIssues` and raises the
    estimate — so the number reflects the actual state of the review. */
export function estimateAcceptance(
  venue: PublicationVenue, paperOverall: number, openIssues: Annotation[] = [],
): number {
  const fitMul = 0.62 + (venue.fit / 100) * 0.78;        // fit 95 → 1.36, 60 → 1.09
  const strengthMul = 0.74 + (paperOverall / 100) * 0.6; // health 91 → 1.29, 72 → 1.17
  const penaltyMul = Math.max(0.3, 1 - weaknessPenalty(venue, openIssues) * 0.02);
  const raw = venue.acceptanceRate * fitMul * strengthMul * penaltyMul;
  return Math.max(3, Math.min(92, Math.round(raw)));
}

/** How close `paperOverall` sits to this venue's difficulty bar (same formula as venues.py). */
export function matchScore(venue: PublicationVenue, paperOverall: number): number {
  const bar = Math.max(50, Math.min(96, 0.55 * (100 - venue.acceptanceRate) + 8 * venue.prestige));
  return Math.max(0, Math.min(100, Math.round(100 - Math.abs(paperOverall - bar))));
}

/* p1 — Attention-Guided Summarization (HCI + NLP, human-centered eval) */
const P1_VENUES: PublicationVenue[] = [
  { id:"chi", name:"CHI", fullName:"ACM CHI Conference on Human Factors in Computing Systems",
    kind:"conference", field:"Human-Computer Interaction", prestige:5, tierLabel:"Flagship venue",
    esteem:"The premier HCI venue — CORE A*, the field's most prestigious conference.",
    fit:95, acceptanceRate:24, deadline:"2026-09-10", deadlineNote:"Abstracts due one week earlier",
    h5:122, location:"Yokohama, Japan", url:"https://dl.acm.org/conference/chi",
    rationale:"Your human-centered evaluation of a summarization interface is squarely CHI's core — an interactive system studied with real users." },
  { id:"iui", name:"IUI", fullName:"ACM Conference on Intelligent User Interfaces",
    kind:"conference", field:"Intelligent User Interfaces", prestige:4, tierLabel:"Top-tier",
    esteem:"The leading venue at the AI × HCI boundary — CORE A.",
    fit:90, acceptanceRate:26, deadline:"2026-10-06", h5:40, location:"Palermo, Italy",
    url:"https://dl.acm.org/conference/iui",
    rationale:"Attention-guided summarization is an intelligent interface; IUI rewards exactly this AI-meets-interaction framing and is a touch less selective than CHI." },
  { id:"acl", name:"ACL", fullName:"Annual Meeting of the Association for Computational Linguistics",
    kind:"conference", field:"Natural Language Processing", prestige:5, tierLabel:"Flagship venue",
    esteem:"The flagship NLP conference — CORE A*, top of the field for language work.",
    fit:82, acceptanceRate:21, deadline:"2026-10-15", deadlineNote:"Via ACL Rolling Review (ARR)",
    h5:202, location:"Toronto, Canada", url:"https://www.aclweb.org/",
    rationale:"Summarization is a core NLP task; if you can foreground the modeling contribution, ACL is a reach worth taking." },
  { id:"emnlp", name:"EMNLP", fullName:"Conference on Empirical Methods in Natural Language Processing",
    kind:"conference", field:"Natural Language Processing", prestige:4, tierLabel:"Top-tier",
    esteem:"Premier empirical-NLP venue — CORE A, close behind ACL.",
    fit:80, acceptanceRate:23, deadline:"2026-08-15", deadlineNote:"Via ARR",
    h5:165, location:"Suzhou, China", url:"https://aclanthology.org/venues/emnlp/",
    rationale:"EMNLP favors strong empirical evaluations of NLP systems — a good fit for your human-centered results and an earlier deadline than ACL." },
  { id:"tochi", name:"TOCHI", fullName:"ACM Transactions on Computer-Human Interaction",
    kind:"journal", field:"Human-Computer Interaction", prestige:5, tierLabel:"Premier journal",
    esteem:"The flagship HCI journal — for deeper, extended treatments.",
    fit:78, acceptanceRate:18, deadline:null, deadlineNote:"Rolling submissions",
    h5:55, url:"https://dl.acm.org/journal/tochi",
    rationale:"If you want to expand the study into a longer, more definitive account, TOCHI takes rolling submissions with no conference deadline pressure." },
  { id:"cscw", name:"CSCW", fullName:"ACM Conference on Computer-Supported Cooperative Work",
    kind:"conference", field:"Human-Computer Interaction", prestige:4, tierLabel:"Top-tier",
    esteem:"Leading venue for collaboration & social computing — CORE A.",
    fit:70, acceptanceRate:26, deadline:"2027-01-15", h5:62, location:"San Diego, USA",
    url:"https://dl.acm.org/conference/cscw",
    rationale:"A fit if you frame summarization around collaborative reading or shared research workflows; otherwise a secondary option." },
];

/* p2 — Federated Fine-Tuning of Clinical Language Models (ML + clinical NLP + privacy) */
const P2_VENUES: PublicationVenue[] = [
  { id:"neurips", name:"NeurIPS", fullName:"Conference on Neural Information Processing Systems",
    kind:"conference", field:"Machine Learning", prestige:5, tierLabel:"Flagship venue",
    esteem:"The most prestigious ML conference in the world — CORE A*.",
    fit:90, acceptanceRate:26, deadline:"2027-05-15", deadlineNote:"Abstracts due one week earlier",
    h5:337, location:"San Diego, USA", url:"https://neurips.cc/",
    rationale:"Federated fine-tuning is a methods contribution with broad ML interest; your 91/100 review makes NeurIPS a realistic target." },
  { id:"chil", name:"CHIL", fullName:"Conference on Health, Inference, and Learning",
    kind:"conference", field:"Machine Learning for Health", prestige:3, tierLabel:"Strong (specialist)",
    esteem:"The focused home for health-ML — respected and fast-rising in the clinical-AI community.",
    fit:93, acceptanceRate:30, deadline:"2026-12-05", h5:25, location:"Cambridge, USA",
    url:"https://www.chilconference.org/",
    rationale:"A near-perfect topical match: clinical models, privacy and learning are exactly CHIL's remit, and it is more receptive than a general-ML venue." },
  { id:"acl2", name:"ACL", fullName:"Annual Meeting of the Association for Computational Linguistics",
    kind:"conference", field:"Natural Language Processing", prestige:5, tierLabel:"Flagship venue",
    esteem:"The flagship NLP conference — CORE A*.",
    fit:80, acceptanceRate:21, deadline:"2026-10-15", deadlineNote:"Via ARR",
    h5:202, location:"Toronto, Canada", url:"https://www.aclweb.org/",
    rationale:"Clinical language models are language models; ACL's clinical-NLP track is a strong home if you lead with the LM contribution." },
  { id:"jamia", name:"JAMIA", fullName:"Journal of the American Medical Informatics Association",
    kind:"journal", field:"Medical Informatics", prestige:4, tierLabel:"Premier journal",
    esteem:"The leading biomedical-informatics journal — high esteem with clinical readers.",
    fit:85, acceptanceRate:20, deadline:null, deadlineNote:"Rolling submissions",
    h5:100, url:"https://academic.oup.com/jamia",
    rationale:"For maximum reach into the clinical community — privacy-preserving models for healthcare land squarely in JAMIA's scope." },
  { id:"natmi", name:"Nature Machine Intelligence", fullName:"Nature Machine Intelligence",
    kind:"journal", field:"Machine Learning", prestige:5, tierLabel:"Premier journal",
    esteem:"Extremely high-impact and highly selective — a career-defining placement.",
    fit:78, acceptanceRate:8, deadline:null, deadlineNote:"Rolling submissions",
    h5:100, url:"https://www.nature.com/natmachintell/",
    rationale:"A reach for broad impact: viable only if the privacy/federation result is genuinely field-shifting. High risk, high reward." },
  { id:"ml4h", name:"ML4H", fullName:"Machine Learning for Health (NeurIPS Workshop)",
    kind:"workshop", field:"Machine Learning for Health", prestige:2, tierLabel:"Workshop",
    esteem:"A well-attended workshop — good for visibility and early feedback, not archival prestige.",
    fit:82, acceptanceRate:45, deadline:"2026-09-12", h5:20, location:"San Diego, USA",
    url:"https://ml4h.cc/",
    rationale:"A low-risk way to get the work in front of the health-ML community quickly while you target a bigger venue." },
];

/* p3 — Tactile Feedback for Mid-Air Gesture Menus (HCI / haptics) */
const P3_VENUES: PublicationVenue[] = [
  { id:"uist", name:"UIST", fullName:"ACM Symposium on User Interface Software and Technology",
    kind:"conference", field:"HCI Systems", prestige:5, tierLabel:"Flagship venue",
    esteem:"The top venue for novel interaction techniques & UI systems — CORE A*.",
    fit:94, acceptanceRate:24, deadline:"2027-04-05", h5:66, location:"Vancouver, Canada",
    url:"https://dl.acm.org/conference/uist",
    rationale:"A new haptic interaction technique is exactly UIST's heartland — this is the most natural home for the paper." },
  { id:"chi3", name:"CHI", fullName:"ACM CHI Conference on Human Factors in Computing Systems",
    kind:"conference", field:"Human-Computer Interaction", prestige:5, tierLabel:"Flagship venue",
    esteem:"The premier HCI venue — CORE A*.",
    fit:88, acceptanceRate:24, deadline:"2026-09-10", deadlineNote:"Abstracts due one week earlier",
    h5:122, location:"Yokohama, Japan", url:"https://dl.acm.org/conference/chi",
    rationale:"CHI values the empirical user study behind your technique; a strong alternative to UIST with an earlier deadline." },
  { id:"toh", name:"IEEE ToH", fullName:"IEEE Transactions on Haptics",
    kind:"journal", field:"Haptics", prestige:4, tierLabel:"Premier journal",
    esteem:"The leading dedicated haptics journal — the specialist gold standard.",
    fit:90, acceptanceRate:22, deadline:null, deadlineNote:"Rolling submissions",
    h5:40, url:"https://www.computer.org/csdl/journal/th",
    rationale:"For the deepest treatment of the tactile-feedback contribution, ToH is the specialist venue haptics researchers read first." },
  { id:"whc", name:"World Haptics", fullName:"IEEE World Haptics Conference",
    kind:"conference", field:"Haptics", prestige:4, tierLabel:"Top-tier (specialist)",
    esteem:"The flagship haptics conference — the ICRA of the haptics community.",
    fit:86, acceptanceRate:40, deadline:"2027-01-20", h5:30, location:"Seoul, South Korea",
    url:"https://www.worldhaptics.org/",
    rationale:"A specialist audience that will fully appreciate the actuator work, and notably more receptive than the general HCI venues." },
  { id:"dis", name:"DIS", fullName:"ACM Conference on Designing Interactive Systems",
    kind:"conference", field:"Interaction Design", prestige:3, tierLabel:"Strong",
    esteem:"A respected design-oriented HCI venue — CORE A/B.",
    fit:74, acceptanceRate:26, deadline:"2026-11-06", h5:44, location:"Madrid, Spain",
    url:"https://dl.acm.org/conference/dis",
    rationale:"A fit if you emphasize the design process and menu ergonomics over the raw technique; a friendlier bar than CHI/UIST." },
];

/* p5 — LLM-Assisted Code Review: A Field Study at Scale (Software Engineering) */
const P5_VENUES: PublicationVenue[] = [
  { id:"icse", name:"ICSE", fullName:"IEEE/ACM International Conference on Software Engineering",
    kind:"conference", field:"Software Engineering", prestige:5, tierLabel:"Flagship venue",
    esteem:"The #1 software-engineering conference — CORE A*, the field's flagship.",
    fit:90, acceptanceRate:20, deadline:"2026-08-14", deadlineNote:"Research track; abstracts due Aug 7",
    h5:90, location:"Rio de Janeiro, Brazil", url:"https://conf.researchr.org/series/icse",
    rationale:"A large-scale field study of an LLM developer tool is prime ICSE material — but the 72/100 health means tightening the threats-to-validity first." },
  { id:"emse", name:"EMSE", fullName:"Empirical Software Engineering (Springer)",
    kind:"journal", field:"Software Engineering", prestige:4, tierLabel:"Premier journal",
    esteem:"The top journal for empirical SE — the natural home for rigorous field studies.",
    fit:92, acceptanceRate:30, deadline:null, deadlineNote:"Rolling submissions",
    h5:66, url:"https://www.springer.com/journal/10664",
    rationale:"Your best-fit option: EMSE prizes exactly this kind of at-scale empirical study, gives room to fully report methodology, and has no deadline crunch." },
  { id:"fse", name:"FSE", fullName:"ACM International Conference on the Foundations of Software Engineering",
    kind:"conference", field:"Software Engineering", prestige:5, tierLabel:"Flagship venue",
    esteem:"Co-flagship with ICSE — CORE A*, equally prestigious.",
    fit:88, acceptanceRate:22, deadline:"2027-02-05", h5:66, location:"Sacramento, USA",
    url:"https://conf.researchr.org/series/fse",
    rationale:"FSE is on par with ICSE and often warmer to industry field studies; a later deadline gives you time to strengthen the analysis." },
  { id:"msr", name:"MSR", fullName:"International Conference on Mining Software Repositories",
    kind:"conference", field:"Software Engineering", prestige:3, tierLabel:"Strong",
    esteem:"The leading venue for data-driven SE studies — respected, CORE A.",
    fit:84, acceptanceRate:28, deadline:"2026-10-09", h5:55, location:"Rio de Janeiro, Brazil",
    url:"https://conf.researchr.org/series/msr",
    rationale:"If the contribution is the dataset and mined patterns from your review logs, MSR is a strong, more attainable fit." },
  { id:"tse", name:"TSE", fullName:"IEEE Transactions on Software Engineering",
    kind:"journal", field:"Software Engineering", prestige:5, tierLabel:"Premier journal",
    esteem:"The most prestigious SE journal — the archival gold standard.",
    fit:80, acceptanceRate:15, deadline:null, deadlineNote:"Rolling submissions",
    h5:90, url:"https://www.computer.org/csdl/journal/ts",
    rationale:"A reach for the definitive archival version once the study is fully matured; highly selective and slow, but the top journal placement." },
];

export const VENUES: Record<string, PublicationVenue[]> = {
  p1: P1_VENUES, p2: P2_VENUES, p3: P3_VENUES, p5: P5_VENUES,
};

/** venues for a paper — falls back to p1's set for papers without a curated list */
export const venuesFor = (id: string): PublicationVenue[] => VENUES[id] ?? VENUES.p1;
