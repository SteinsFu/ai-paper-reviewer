/* ============================================================
   Margin — sample data
   A realistic HCI/ML manuscript + AI review analysis
   ============================================================ */
(function () {

  // ---- Feedback categories -------------------------------------------------
  const CATEGORIES = {
    writing:   { id: "writing",   label: "Writing quality",     color: "var(--info)",     soft: "var(--info-soft)",     hex: "#0a84ff" },
    structure: { id: "structure", label: "Paper structure",     color: "var(--violet)",   soft: "var(--violet-soft)",   hex: "#5e5ce6" },
    method:    { id: "method",    label: "Methodology",         color: "var(--teal)",     soft: "var(--teal-soft)",     hex: "#00a3a3" },
    logic:     { id: "logic",     label: "Logical consistency", color: "var(--pink)",     soft: "var(--pink-soft)",     hex: "#d83b8e" },
    novelty:   { id: "novelty",   label: "Novelty",             color: "var(--accent-deep)", soft: "var(--accent-soft)", hex: "#f57221" },
    citation:  { id: "citation",  label: "Citation usage",      color: "var(--ok)",       soft: "var(--ok-soft)",       hex: "#30b85a" },
    format:    { id: "format",    label: "Formatting",          color: "var(--text-2)",   soft: "var(--surface-3)",     hex: "#6e6e73" },
  };
  const CAT_ORDER = ["writing","structure","method","logic","novelty","citation","format"];

  const SEVERITY = {
    critical: { id:"critical", label:"Critical", color:"var(--critical)", soft:"var(--critical-soft)", hex:"#ff3b30", rank:3 },
    moderate: { id:"moderate", label:"Suggestion", color:"var(--warn)",   soft:"var(--warn-soft)",     hex:"#ff9f0a", rank:2 },
    minor:    { id:"minor",    label:"Minor",     color:"var(--info)",     soft:"var(--info-soft)",     hex:"#0a84ff", rank:1 },
  };

  // ---- The paper -----------------------------------------------------------
  const PAPER = {
    title: "Attention-Guided Summarization of Long Scientific Documents: A Human-Centered Evaluation",
    authors: "A. Reyes, M. Tanaka, L. Okafor, P. Singh",
    venue: "Submitted to CHI 2026 · Papers",
    pages: 12,
    words: 8740,
    figures: 5,
    refs: 41,
    overall: 78,      // /100
    recommendation: "minor",  // minor | major | reject | accept
  };

  // health scores per category /100
  const SCORES = {
    writing: 74, structure: 88, method: 69, logic: 71, novelty: 64, citation: 82, format: 91,
  };

  // ---- Manuscript content --------------------------------------------------
  // blocks: {type:'h1'|'h2'|'p'|'fig', section, runs:[{t}|{t,a:annoId}]}
  const t = (s) => ({ t: s });
  const a = (s, id) => ({ t: s, a: id });

  const MANUSCRIPT = [
    { type:"h1", section:"Abstract", runs:[t("Abstract")] },
    { type:"p", section:"Abstract", runs:[
      t("Scientific literature is growing faster than any researcher can read. We present "),
      t("SciSumm, an attention-guided summarization model that condenses long scientific documents into structured, section-aware digests. "),
      a("Our approach performs significantly better than existing baselines and produces summaries that readers prefer.", "a1"),
      t(" We further conduct a human-centered evaluation with 24 graduate students and report on perceived usefulness, trust, and reading efficiency."),
    ]},

    { type:"h1", section:"1. Introduction", runs:[t("1  Introduction")] },
    { type:"p", section:"1. Introduction", runs:[
      t("The volume of published research has reached a point where staying current in a single subfield is effectively impossible for an individual. "),
      a("Over two million scholarly articles are published every year, a number that has been steadily increasing for decades.", "a2"),
      t(" Automatic summarization promises relief, yet most systems are tuned for news articles and short passages rather than the long, structured, citation-dense documents typical of science."),
    ]},
    { type:"p", section:"1. Introduction", runs:[
      t("In this paper we ask whether attention can be steered toward the rhetorical structure of a paper — its claims, methods, and findings — to produce summaries that researchers actually trust. We make three contributions: (1) a section-aware attention mechanism, (2) a curated evaluation corpus, and (3) a mixed-methods user study."),
    ]},

    { type:"h1", section:"2. Related Work", runs:[t("2  Related Work")] },
    { type:"p", section:"2. Related Work", runs:[
      t("Extractive and abstractive summarization have been studied for decades. Recent transformer approaches dominate the abstractive setting. "),
      a("Our section-aware attention is closely related to the hierarchical attention of Chen et al. (2023), though we apply it to a different domain.", "a3"),
      t(" We differ in that we evaluate with human readers rather than ROUGE alone."),
    ]},

    { type:"h1", section:"3. Method", runs:[t("3  Method")] },
    { type:"p", section:"3. Method", runs:[
      t("SciSumm encodes a document as a sequence of section blocks. A learned gating vector modulates cross-attention so that tokens in the Methods and Results sections receive higher weight when generating the corresponding summary segments. "),
      a("The gating weights were tuned manually on a held-out set; we did not run a formal hyper-parameter search due to compute constraints.", "a4"),
    ]},
    { type:"p", section:"3. Method", runs:[
      a("Because the model attends primarily to Methods and Results, it is by design robust to weak or missing abstracts.", "a5"),
      t(" This makes SciSumm particularly suitable for preprints and technical reports where abstracts are often absent or unreliable."),
    ]},

    { type:"h1", section:"4. Study Design", runs:[t("4  Study Design")] },
    { type:"p", section:"4. Study Design", runs:[
      t("We recruited "),
      a("24 graduate students from a single department", "a6"),
      t(" and asked each to read three summaries (SciSumm, a strong baseline, and a human-written reference) in counterbalanced order. Participants rated usefulness and trust on 7-point scales and completed a comprehension quiz."),
    ]},
    { type:"fig", section:"4. Study Design", fig:"fig3", caption:"Figure 3. Per-condition ratings across the three summary sources. Error bars omitted.", anno:"a7" },

    { type:"h1", section:"5. Results", runs:[t("5  Results")] },
    { type:"p", section:"5. Results", runs:[
      t("Participants rated SciSumm summaries as more useful than the baseline (mean 5.6 vs. 4.9). "),
      a("Trust ratings were higher for the human reference than for either automatic system, suggesting that readers remain skeptical of machine summaries even when accuracy is comparable.", "a8"),
      t(" Comprehension scores did not differ significantly across conditions."),
    ]},

    { type:"h1", section:"6. Discussion", runs:[t("6  Discussion")] },
    { type:"p", section:"6. Discussion", runs:[
      a("It was found by the authors that the steering of attention toward structurally salient regions of the document was beneficial in a manner that was perceived positively by the participants who were recruited for the study.", "a9"),
      t(" We believe this points toward structure-aware models as a promising direction for scholarly tools."),
    ]},
  ];

  // ---- Annotations ---------------------------------------------------------
  const ANNOTATIONS = [
    { id:"a1", cat:"writing", sev:"moderate", section:"Abstract",
      title:"Vague, unquantified claim",
      excerpt:"…performs significantly better than existing baselines and produces summaries that readers prefer.",
      comment:"\u201CSignificantly better\u201D appears in the abstract with no metric, margin, or statistical test attached. Reviewers will read this as overclaiming. Anchor it to a concrete result.",
      suggestion:"SciSumm improves usefulness ratings by 14% over the strongest baseline (5.6 vs. 4.9 on a 7-point scale, p < .01) in a study with 24 graduate readers.",
      good:"Strong abstracts pair every comparative claim with its magnitude and evidence, e.g. \u201Creduces error by 12% (p < .01)\u201D rather than \u201Csignificantly better.\u201D" },

    { id:"a2", cat:"citation", sev:"critical", section:"1. Introduction",
      title:"Strong empirical claim, no citation",
      excerpt:"Over two million scholarly articles are published every year…",
      comment:"This is a load-bearing statistic in your motivation but carries no reference. Unsupported numbers are a fast path to a methodology flag in review.",
      suggestion:"Attach a primary source for the figure (e.g. the STM Report 2023, or Bornmann & Mutz, 2015) and state the year the estimate refers to.",
      missingRef:"Bornmann, L., & Mutz, R. (2015). Growth rates of modern science. JASIST, 66(11)." },

    { id:"a3", cat:"novelty", sev:"critical", section:"2. Related Work",
      title:"Potential novelty overlap",
      excerpt:"Our section-aware attention is closely related to the hierarchical attention of Chen et al. (2023)…",
      comment:"Chen et al. (2023) already propose section-conditioned hierarchical attention for documents. As written, the distinction is only the domain and the use of human evaluation. Reviewers will press hard on what is technically new.",
      suggestion:"Add an explicit contribution-delta paragraph: what does the learned gating vector do that Chen\u2019s fixed hierarchy does not? Quantify the architectural and empirical difference.",
      overlap: 71 },

    { id:"a4", cat:"method", sev:"moderate", section:"3. Method",
      title:"Hyper-parameters tuned by hand",
      excerpt:"The gating weights were tuned manually on a held-out set; we did not run a formal hyper-parameter search…",
      comment:"Manual tuning is acceptable under compute limits, but it must be reported transparently and the held-out set described. Otherwise reproducibility is in question.",
      suggestion:"Report the search ranges considered, the held-out set size and source, and the selection criterion. Acknowledge it as a limitation in §6." },

    { id:"a5", cat:"logic", sev:"critical", section:"3. Method",
      title:"Claim contradicted by your own results",
      excerpt:"Because the model attends primarily to Methods and Results, it is by design robust to weak or missing abstracts.",
      comment:"This robustness claim is asserted in §3 but never tested. There is no ablation with abstracts removed, and §5 reports no such condition. The conclusion does not follow from the evidence presented.",
      suggestion:"Either add an ablation that removes/corrupts abstracts and measures the effect, or soften to a hypothesis (\u201Cwe expect\u2026, which we leave to future work\u201D)." },

    { id:"a6", cat:"method", sev:"moderate", section:"4. Study Design",
      title:"Sample size & population not justified",
      excerpt:"24 graduate students from a single department",
      comment:"N=24 from one department limits generalizability and statistical power. No power analysis is reported. This is the single most likely point reviewers will contest.",
      suggestion:"Add a short power-analysis justification for N, describe the department/field, and explicitly scope your claims to that population in the discussion." },

    { id:"a7", cat:"format", sev:"minor", section:"4. Study Design",
      title:"Figure missing error bars",
      excerpt:"Figure 3 — per-condition ratings, error bars omitted.",
      comment:"A bar chart of rating means without dispersion is hard to interpret and undercuts the statistical claims. Figure 3 is also referenced after the chart appears.",
      suggestion:"Add 95% confidence intervals or standard error bars, label the y-axis units, and reference the figure before it appears in the text.",
      isFigure: true },

    { id:"a8", cat:"writing", sev:"minor", section:"5. Results",
      title:"Interpretation embedded in results",
      excerpt:"…suggesting that readers remain skeptical of machine summaries even when accuracy is comparable.",
      comment:"Nicely written, but this is interpretation living in the Results section. Keep Results descriptive and move the inference to Discussion to preserve structure.",
      suggestion:"Report the trust means in §5; move the \u201Creaders remain skeptical\u201D interpretation to §6." },

    { id:"a9", cat:"writing", sev:"moderate", section:"6. Discussion",
      title:"Dense passive construction",
      excerpt:"It was found by the authors that the steering of attention toward structurally salient regions…",
      comment:"42-word sentence, triple-nested passive voice. Readability here is well below the rest of the paper.",
      suggestion:"Steering attention toward structurally salient regions helped, and participants noticed.",
      good:"Prefer active voice and one idea per sentence: \u201CSteering attention to salient regions helped, and participants noticed.\u201D" },
  ];

  // ---- Visual feedback items (before / after) ------------------------------
  const VISUALS = [
    { id:"a7", kind:"figure", title:"Figure 3 — Per-condition ratings", cat:"format", sev:"minor",
      problem:"Bar chart shows means only. No error bars, unlabeled y-axis, referenced after it appears.",
      beforeLabel:"figure 3 · as submitted", afterLabel:"figure 3 · suggested",
      fix:"Add 95% CIs, label axis \u201CMean rating (1\u20137)\u201D, order bars by condition." },
    { id:"a9", kind:"paragraph", title:"Discussion opening sentence", cat:"writing", sev:"moderate",
      problem:"42-word triple-passive sentence; readability dips sharply.",
      before:"It was found by the authors that the steering of attention toward structurally salient regions of the document was beneficial in a manner that was perceived positively by the participants who were recruited for the study.",
      after:"Steering attention toward structurally salient regions helped — and participants noticed.",
      metricBefore:"42 words · passive · grade 19", metricAfter:"11 words · active · grade 9" },
    { id:"a1", kind:"paragraph", title:"Abstract claim", cat:"writing", sev:"moderate",
      problem:"Comparative claim with no magnitude or evidence.",
      before:"Our approach performs significantly better than existing baselines and produces summaries that readers prefer.",
      after:"SciSumm raises usefulness ratings 14% over the strongest baseline (5.6 vs. 4.9, p < .01; N = 24).",
      metricBefore:"0 metrics cited", metricAfter:"3 metrics cited" },
  ];

  // ---- Novelty & citation --------------------------------------------------
  const RELATED = [
    { title:"Hierarchical Attention Networks for Long-Document Summarization", authors:"Chen, Liu, Park", venue:"ACL 2023", sim:71, flag:"overlap",
      note:"Proposes section-conditioned hierarchical attention. Your closest prior work — distinction needs sharpening." },
    { title:"Section-Aware Summarization of Biomedical Articles", authors:"Müller et al.", venue:"EMNLP 2022", sim:58, flag:"related",
      note:"Section-structure summarization in a different domain; cited, well differentiated." },
    { title:"Do Readers Trust Machine Summaries? A Study", authors:"Okonkwo & Patel", venue:"CHI 2024", sim:46, flag:"related",
      note:"Human trust in automatic summaries — directly relevant to your §5, currently uncited." },
    { title:"PEGASUS: Pre-training for Abstractive Summarization", authors:"Zhang et al.", venue:"ICML 2020", sim:33, flag:"baseline",
      note:"Common baseline; appropriately cited." },
  ];

  const MISSING_REFS = [
    { for:"a2", text:"Bornmann, L., & Mutz, R. (2015). Growth rates of modern science. JASIST.", reason:"Supports the \u20182M articles/year\u2019 claim in §1." },
    { text:"Okonkwo, P., & Patel, R. (2024). Do Readers Trust Machine Summaries? CHI.", reason:"Directly relevant to your trust findings in §5; should be discussed." },
    { text:"Lin, C-Y. (2004). ROUGE: A Package for Automatic Evaluation of Summaries.", reason:"You critique ROUGE-only evaluation but never cite the metric itself." },
  ];

  const NOVELTY = {
    score: 64,
    verdict: "Moderate — contribution is real but under-differentiated",
    summary: "The core idea (learned gating over section-structured attention) is a meaningful step beyond fixed hierarchical attention, and the human-centered evaluation is a genuine contribution. However, the overlap with Chen et al. (2023) is high (71%) and is not addressed head-on. The paper will be stronger if the technical delta is stated explicitly and quantified.",
    strengths: [
      "Human-centered evaluation of scholarly summarization is uncommon and valuable.",
      "Learned gating vector is a novel mechanism relative to fixed hierarchies.",
      "Curated evaluation corpus is a reusable contribution.",
    ],
    risks: [
      "71% conceptual overlap with Chen et al. (2023), under-acknowledged.",
      "Untested robustness claim weakens the novelty story.",
      "Trust study (Okonkwo & Patel, 2024) covers similar ground and is uncited.",
    ],
  };

  // ---- Structured review report -------------------------------------------
  const REPORT = {
    summary: "The paper introduces SciSumm, a section-aware attention model for summarizing long scientific documents, and evaluates it with 24 graduate readers. The direction is timely and the human-centered evaluation is a welcome departure from ROUGE-only studies. The contribution is real but currently under-differentiated from prior hierarchical-attention work, and several claims outrun the evidence. With a sharper novelty framing and two targeted experiments, this would be a solid contribution.",
    strengths: [
      "Human-centered evaluation (usefulness, trust, comprehension) is uncommon for scholarly summarization and adds genuine value.",
      "The learned gating mechanism is a clean, well-motivated idea.",
      "Writing is mostly clear and the paper is well organized; formatting is clean.",
    ],
    weaknesses: [
      "Novelty relative to Chen et al. (2023) is not articulated; the technical delta must be made explicit and quantified.",
      "The §3 robustness-to-missing-abstracts claim is asserted but never tested, contradicting the evidence presented.",
      "N=24 from a single department is under-powered and under-justified; scope the claims accordingly.",
      "Several abstract/intro claims are unquantified or uncited.",
    ],
    minor: [
      "Figure 3 lacks error bars and axis labels; it is also referenced after it appears.",
      "Move results-section interpretation (§5) into the Discussion.",
      "Tighten the dense passive sentence opening §6.",
    ],
    recommendation: "minor",
    confidence: 4,
  };

  const RECS = {
    accept: { label:"Accept", color:"var(--ok)", hex:"#30b85a" },
    minor:  { label:"Minor revision", color:"var(--warn)", hex:"#ff9f0a" },
    major:  { label:"Major revision", color:"var(--accent-deep)", hex:"#f57221" },
    reject: { label:"Reject", color:"var(--critical)", hex:"#ff3b30" },
  };

  // ---- Library (dashboard) -------------------------------------------------
  const LIBRARY = [
    { id:"p1", title:"Attention-Guided Summarization of Long Scientific Documents", authors:"Reyes, Tanaka, Okafor, Singh", venue:"CHI 2026", status:"in-review", score:78, issues:9, updated:"2 hours ago", current:true },
    { id:"p2", title:"Federated Fine-Tuning Under Non-IID Clinical Data", authors:"Nakamura, Bauer", venue:"NeurIPS 2025", status:"done", score:91, issues:3, updated:"Yesterday" },
    { id:"p3", title:"Tactile Feedback for Mid-Air Gesture Menus", authors:"Owusu, Lindqvist, Carter", venue:"UIST 2025", status:"done", score:84, issues:6, updated:"3 days ago" },
    { id:"p4", title:"A Survey of Differential Privacy in Recommender Systems", authors:"Petrova et al.", venue:"ACM Comput. Surv.", status:"draft", score:null, issues:0, updated:"5 days ago" },
    { id:"p5", title:"LLM-Assisted Code Review: A Field Study at Scale", authors:"Hassan, Mbeki", venue:"ICSE 2026", status:"done", score:72, issues:11, updated:"1 week ago" },
  ];

  // ---- Analyzing pipeline steps -------------------------------------------
  const PIPELINE = [
    { label:"Parsing manuscript", detail:"12 pages · 8,740 words · 5 figures" },
    { label:"Assessing writing & structure", detail:"section rhetoric, readability" },
    { label:"Auditing methodology & logic", detail:"claims vs. evidence" },
    { label:"Cross-referencing literature", detail:"2.1M papers · novelty check" },
    { label:"Verifying citations", detail:"41 references resolved" },
    { label:"Drafting review report", detail:"structured, editable" },
  ];

  window.DATA = {
    CATEGORIES, CAT_ORDER, SEVERITY, PAPER, SCORES, MANUSCRIPT, ANNOTATIONS,
    VISUALS, RELATED, MISSING_REFS, NOVELTY, REPORT, RECS, LIBRARY, PIPELINE,
  };
})();
