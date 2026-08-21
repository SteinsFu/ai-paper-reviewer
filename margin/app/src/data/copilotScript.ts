/* ============================================================
   Margin — canned copilot answers (mock backend)
   Matched by keyword against the last user message.
   First matching intent wins; order = priority.
   ============================================================ */

export interface CopilotIntent {
  keywords: string[];
  reply: string;
}

export const INTENTS: CopilotIntent[] = [
  {
    keywords: ["novelty", "novel", "overlap", "chen"],
    reply:
      "The novelty concern is real but fixable. The closest prior work is Chen et al. (ACL 2023), which already proposes section-conditioned hierarchical attention — Margin measured a 71% conceptual overlap. What sets this paper apart is the learned gating vector and the human-centered evaluation, but neither is framed as the delta. I'd add a short contribution paragraph at the end of §2 that states explicitly what the gating mechanism does that a fixed hierarchy cannot, ideally with one ablation number to back it up.",
  },
  {
    keywords: ["sample", "n=24", "24", "participants", "power", "study design"],
    reply:
      "N = 24 from a single department is the most likely point of reviewer pushback. It isn't fatal for a CHI paper, but it needs three things: a brief power analysis justifying the sample size, a description of the department and field so readers can judge generalizability, and explicitly scoped claims in the Discussion (\"among graduate students in one HCI department…\"). With those, the study reads as honest rather than under-powered.",
  },
  {
    keywords: ["figure", "fig", "error bar", "chart"],
    reply:
      "Figure 3 has three issues: it shows means without any dispersion (add 95% CIs or standard error bars), the y-axis is unlabeled (it should read \"Mean rating (1–7)\"), and it's referenced after it appears in the text. All are quick fixes — the Visual feedback tab shows a suggested redesign side-by-side with the submitted version.",
  },
  {
    keywords: ["weakness", "weaknesses", "summary", "summarize", "main issue", "biggest"],
    reply:
      "The three weaknesses that matter most, in order: (1) the novelty delta versus Chen et al. (2023) is never stated explicitly — that's the one that could sink the paper; (2) the §3 claim that the model is robust to missing abstracts is asserted but never tested, which reviewers will read as a logical gap; (3) the user study is N = 24 from one department with no power analysis. Everything else — the figure, the passive Discussion opener, the uncited statistic — is minor polish.",
  },
  {
    keywords: ["robust", "abstract", "ablation", "logic", "contradict"],
    reply:
      "The robustness claim in §3 (\"by design robust to weak or missing abstracts\") is the clearest logical gap in the paper: it's presented as a property of the architecture, but no experiment tests it — §5 has no missing-abstract condition. Two ways out: run a small ablation that corrupts or removes abstracts and report the effect, or soften the sentence to a hypothesis and flag it as future work. The first is stronger if compute allows.",
  },
  {
    keywords: ["citation", "reference", "missing ref", "cite"],
    reply:
      "Margin found three references worth adding: Bornmann & Mutz (2015) to support the \"two million articles a year\" statistic in §1, Okonkwo & Patel (CHI 2024) whose trust study covers ground very close to your §5 findings, and Lin (2004) — you critique ROUGE-only evaluation but never cite ROUGE itself. The first two are the important ones; the Okonkwo & Patel omission could read as unawareness of directly relevant work.",
  },
  {
    keywords: ["recommend", "verdict", "decision", "accept", "reject"],
    reply:
      "The draft recommendation is minor revision with confidence 4/5. The contribution is genuine — human-centered evaluation of scholarly summarization is rare and the gating idea is clean — but the novelty framing and the untested robustness claim need fixing before this is ready. Neither requires new core research, which is why it stays at minor rather than major revision.",
  },
  {
    keywords: ["writing", "passive", "readability", "style"],
    reply:
      "The writing is mostly solid — the overall writing score is 74/100. The two spots that drag it down: the Discussion opens with a 42-word, triple-nested passive sentence (the suggested rewrite cuts it to 11 words, active voice), and the abstract makes a comparative claim with no magnitude attached. Both have one-click rewrites in the Reviewer notes tab.",
  },
];

export const FALLBACK = (paperTitle: string): string =>
  `I can help you dig into any part of the review for “${paperTitle}”. Try asking about the novelty overlap, the study design and sample size, the figure issues, missing citations, or the overall recommendation — or ask me to summarize the main weaknesses.`;

export const SUGGESTED_PROMPTS = [
  "Summarize the main weaknesses",
  "Is the novelty concern serious?",
  "What citations are missing?",
];
