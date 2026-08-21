/* ============================================================
   Margin — sample data
   Four realistic manuscripts, each written as a full ~6-page paper
   (two-column Paper view), each with its own AI review and a
   DIFFERENT family of errors + different figure/plot types.
   Screens never import this directly — they go through services/.
   The presentation taxonomies (CATEGORIES, SEVERITY, RECS) are
   exported for UI use; they are config, not data.
   ============================================================ */
import type {
  Category, CategoryId, LibraryPaper, PaperVersion, PipelineStep, Recommendation,
  Reference, ReviewBundle, Severity, SeverityId, TextRun,
} from "../services/types";

// ---- Feedback categories (UI taxonomy) ------------------------------------
export const CATEGORIES: Record<CategoryId, Category> = {
  writing:   { id: "writing",   label: "Writing quality",     color: "var(--info)",        soft: "var(--info-soft)",    hex: "#0a84ff" },
  structure: { id: "structure", label: "Paper structure",     color: "var(--violet)",      soft: "var(--violet-soft)",  hex: "#5e5ce6" },
  method:    { id: "method",    label: "Methodology",         color: "var(--teal)",        soft: "var(--teal-soft)",    hex: "#00a3a3" },
  logic:     { id: "logic",     label: "Logical consistency", color: "var(--pink)",        soft: "var(--pink-soft)",    hex: "#d83b8e" },
  novelty:   { id: "novelty",   label: "Novelty",             color: "var(--accent-deep)", soft: "var(--accent-soft)",  hex: "#f57221" },
  citation:  { id: "citation",  label: "Citation usage",      color: "var(--ok)",          soft: "var(--ok-soft)",      hex: "#30b85a" },
  format:    { id: "format",    label: "Formatting",          color: "var(--text-2)",      soft: "var(--surface-3)",    hex: "#6e6e73" },
};
export const CAT_ORDER: CategoryId[] = ["writing","structure","method","logic","novelty","citation","format"];

export const SEVERITY: Record<SeverityId, Severity> = {
  critical: { id:"critical", label:"Critical",   color:"var(--critical)", soft:"var(--critical-soft)", hex:"#ff3b30", rank:3 },
  moderate: { id:"moderate", label:"Suggestion", color:"var(--warn)",     soft:"var(--warn-soft)",     hex:"#ff9f0a", rank:2 },
  minor:    { id:"minor",    label:"Minor",      color:"var(--info)",     soft:"var(--info-soft)",     hex:"#0a84ff", rank:1 },
};

export const RECS: Record<Recommendation, { label: string; color: string; hex: string }> = {
  accept: { label:"Accept",         color:"var(--ok)",          hex:"#30b85a" },
  minor:  { label:"Minor revision", color:"var(--warn)",        hex:"#ff9f0a" },
  major:  { label:"Major revision", color:"var(--accent-deep)", hex:"#f57221" },
  reject: { label:"Reject",         color:"var(--critical)",    hex:"#ff3b30" },
};

// run helpers: t() = plain text, a() = text carrying an annotation id
const t = (s: string): TextRun => ({ t: s });
const a = (s: string, id: string): TextRun => ({ t: s, a: id });
// reference helper
const ref = (id: string, text: string): Reference => ({ id, text });

/* ============================================================
   p1 — Attention-Guided Summarization (CHI, minor revision)
   ERROR FAMILY: overclaiming + weak statistics/methodology.
   No significance test, small single-department sample, missing
   baseline, an untested robustness claim, a novelty overlap, and
   a figure with no error bars.
   ============================================================ */
const P1: ReviewBundle = {
  paper: {
    title: "Attention-Guided Summarization of Long Scientific Documents: A Human-Centered Evaluation",
    authors: "A. Reyes, M. Tanaka, L. Okafor, P. Singh",
    venue: "Submitted to CHI 2026 · Papers",
    pages: 12, words: 8740, figures: 4, refs: 41,
    overall: 78, recommendation: "minor",
  },
  scores: { writing: 74, structure: 86, method: 66, logic: 68, novelty: 63, citation: 79, format: 84 },
  manuscript: [
    { type:"h1", section:"Abstract", runs:[t("Abstract")] },
    { type:"p", section:"Abstract", runs:[
      t("Scientific literature is growing faster than any individual can read. We present SciSumm, an attention-guided summarization model that condenses long scientific documents into structured, section-aware digests. "),
      a("Our approach performs significantly better than existing baselines and produces summaries that readers strongly prefer.", "a1"),
      t(" We further conduct a human-centered evaluation with 24 graduate students and report on perceived usefulness, trust, and reading efficiency. Results suggest that section-aware guidance improves both objective comprehension and subjective satisfaction over generic abstractive systems.") ] },

    { type:"h1", section:"1. Introduction", runs:[t("1. Introduction")] },
    { type:"p", section:"1. Introduction", runs:[
      t("The volume of published research has reached a point where staying current in even a narrow subfield is effectively impossible for one person. "),
      a("Over two million scholarly articles are published every year, a number that has been rising steadily for decades.", "a2"),
      t(" Automatic summarization promises relief, yet most deployed systems are tuned for news and produce fluent but shallow digests that omit the methodological detail scientists actually need.") ] },
    { type:"p", section:"1. Introduction", runs:[
      t("We argue that summaries of scientific work should respect the rhetorical structure of a paper — separating problem, method, and evidence — rather than compressing everything into a single paragraph. SciSumm operationalizes this idea with a section-aware attention mechanism that conditions generation on the document's headings.") ] },

    { type:"h1", section:"2. Related Work", runs:[t("2. Related Work")] },
    { type:"p", section:"2. Related Work", runs:[
      t("Abstractive summarization has advanced rapidly with pretrained transformers, and long-document variants extend attention to thousands of tokens. "),
      a("Our section-aware attention is closely related to the hierarchical attention of Chen et al. (2023), which conditions decoding on document sections.", "a3"),
      t(" Human-centered evaluations of summarization remain comparatively rare; most prior work reports ROUGE against reference summaries rather than measuring what readers understand or trust.") ] },

    { type:"h1", section:"3. Method", runs:[t("3. Method")] },
    { type:"p", section:"3. Method", runs:[
      t("SciSumm encodes a document with a sparse long-range transformer and adds a section-routing head that assigns each generated sentence to a target section. The routing head is trained jointly with the language-modeling objective using a small auxiliary loss. "),
      a("A tuning coefficient balances the two losses; we set it to the value that worked best in preliminary experiments.", "a6"),
      t(" Decoding uses constrained beam search that enforces at least one sentence per detected section.") ] },
    { type:"fig", section:"3. Method", fig:"fig1", anno:"a7", span:true,
      caption:"Figure 1. Mean reader preference (1–7) for SciSumm vs. two baselines across three document types. Bars show means; error bars are omitted.",
      plot:{ type:"bars", yLabel:"Preference (1–7)", categories:["Bio","CS","Physics"],
        series:[ { name:"SciSumm", values:[5.8, 5.4, 5.1] }, { name:"BART-long", values:[4.6, 4.5, 4.2] }, { name:"Generic", values:[3.9, 4.1, 3.7] } ] } },

    { type:"h1", section:"4. Study Design", runs:[t("4. Study Design")] },
    { type:"p", section:"4. Study Design", runs:[
      t("We recruited "),
      a("24 graduate students from a single department", "a4"),
      t(" and asked each to read three summaries — one per system — for papers drawn from their own field. After each summary, participants answered comprehension questions and rated usefulness and trust on seven-point scales. Presentation order was fixed across participants to keep the protocol simple.") ] },
    { type:"p", section:"4. Study Design", runs:[
      t("We compared SciSumm against a strong long-document abstractive model and a generic news summarizer. "),
      a("We report mean ratings and comprehension accuracy for each system; differences between systems are described in the text.", "a8"),
      t(" No formal power analysis was performed.") ] },

    { type:"h1", section:"5. Results", runs:[t("5. Results")] },
    { type:"p", section:"5. Results", runs:[
      t("Readers rated SciSumm summaries higher on usefulness and trust than both baselines, and comprehension accuracy was highest for SciSumm across all three fields. Reading time also fell relative to reading the full paper, with the largest savings on the longest documents (Figure 2).") ] },
    { type:"fig", section:"5. Results", fig:"fig2", anno:"", span:true,
      caption:"Figure 2. Mean reading time (minutes) as a function of document length for SciSumm summaries vs. reading the full paper.",
      plot:{ type:"line", xLabel:"Document length (pages)", yLabel:"Reading time (min)", x:[6,10,14,18,22],
        series:[ { name:"Full paper", values:[9,15,22,29,37] }, { name:"SciSumm", values:[4,5,6,7,8] } ] } },
    { type:"p", section:"5. Results", runs:[
      a("Because the model attends primarily to section headings, it is by design robust to weak or missing abstracts.", "a5"),
      t(" We therefore expect SciSumm to generalize to preprints and technical reports where abstracts are often absent or unreliable.") ] },

    { type:"h1", section:"6. Discussion", runs:[t("6. Discussion")] },
    { type:"p", section:"6. Discussion", runs:[
      t("The study suggests that respecting document structure helps readers more than raw fluency. Participants frequently mentioned that per-section digests made it easier to decide whether a paper was worth reading in full — a decision-support role that ROUGE cannot capture.") ] },
    { type:"p", section:"6. Discussion", runs:[
      a("These results demonstrate that section-aware summarization is the right approach for scientific reading and should replace generic summarizers in research tools.", "a9"),
      t(" We see clear opportunities to extend the routing head to figures and tables, which participants wanted summarized as well.") ] },

    { type:"h1", section:"7. Conclusion", runs:[t("7. Conclusion")] },
    { type:"p", section:"7. Conclusion", runs:[
      t("We introduced SciSumm, a section-aware summarizer for long scientific documents, and evaluated it with readers rather than reference overlap. The evaluation points to gains in comprehension, trust, and reading efficiency, and motivates larger, multi-institution studies to confirm the effect.") ] },
  ],
  annotations: [
    { id:"a1", cat:"writing", sev:"moderate", section:"Abstract",
      title:"Vague, unquantified superlative", excerpt:"Our approach performs significantly better than existing baselines and produces summaries that readers strongly prefer.",
      comment:"“Significantly better” implies a statistical test that isn't reported, and “strongly prefer” isn't quantified. State the effect size and the test, or soften the claim.",
      suggestion:"In our study, readers rated SciSumm summaries higher on usefulness and trust than both baselines (mean 5.4 vs. 4.4 on a 7-point scale).",
      rewrite:"In our study, readers rated SciSumm summaries higher on usefulness and trust than both baselines (mean 5.4 vs. 4.4 on a 7-point scale).",
      good:"Reviewers reward precise, testable claims over superlatives." },
    { id:"a2", cat:"citation", sev:"critical", section:"1. Introduction",
      title:"Load-bearing statistic, no citation", excerpt:"Over two million scholarly articles are published every year…",
      comment:"This number anchors your motivation but carries no reference. Unsupported figures are a fast path to a methodology flag.",
      suggestion:"Attribute the figure to a source such as the STM Report or Scopus/Web of Science counts.",
      missingRef:"The STM Report: An overview of scientific and scholarly publishing (2018)." },
    { id:"a3", cat:"novelty", sev:"critical", section:"2. Related Work", overlap:71,
      title:"Potential novelty overlap", excerpt:"Our section-aware attention is closely related to the hierarchical attention of Chen et al. (2023)…",
      comment:"Chen et al. (2023) already propose section-conditioned hierarchical attention. As written, the distinction is only the domain and the use of human evaluation. Reviewers will press on what is technically new.",
      suggestion:"Add a direct comparison to Chen et al. (2023) and state precisely what differs — the routing head, the constrained decoding, or the training objective." },
    { id:"a4", cat:"method", sev:"critical", section:"4. Study Design",
      title:"Small, non-representative sample", excerpt:"24 graduate students from a single department",
      comment:"n = 24 from one department limits both power and external validity. Effects may not generalize beyond that population, and small n inflates the risk of false positives.",
      suggestion:"Report a power analysis, recruit across departments/institutions, or frame the study explicitly as a pilot." },
    { id:"a5", cat:"logic", sev:"critical", section:"5. Results",
      title:"Claim contradicted by your own design", excerpt:"Because the model attends primarily to section headings, it is by design robust to weak or missing abstracts.",
      comment:"Robustness to missing abstracts is asserted but never tested — no ablation removes abstracts, and §5 reports no such condition. The conclusion does not follow from the evidence.",
      suggestion:"Either run the missing-abstract ablation or remove the robustness claim." },
    { id:"a6", cat:"method", sev:"moderate", section:"3. Method",
      title:"Opaque hyperparameter tuning", excerpt:"we set it to the value that worked best in preliminary experiments",
      comment:"“Worked best in preliminary experiments” is not reproducible. Report the search range, the selection criterion, and the final value.",
      suggestion:"State the grid searched (e.g. λ ∈ {0.1, 0.3, 0.5}), the validation metric, and the chosen value (λ = 0.3)." },
    { id:"a7", cat:"format", sev:"minor", section:"3. Method", isFigure:true,
      title:"Figure 1 has no error bars", excerpt:"Bars show means; error bars are omitted.",
      comment:"Reporting means without variability makes the comparison impossible to judge. Add error bars (SD or 95% CI) and note n per condition.",
      suggestion:"Add 95% confidence intervals to each bar and report n in the caption." },
    { id:"a8", cat:"writing", sev:"minor", section:"4. Study Design",
      title:"Results described, not tested", excerpt:"differences between systems are described in the text",
      comment:"Describing differences narratively invites cherry-picking. Pre-register or at least report the inferential test used for each comparison.",
      suggestion:"Specify the test (e.g. repeated-measures ANOVA with Holm correction) and report exact p-values and effect sizes." },
    { id:"a9", cat:"writing", sev:"moderate", section:"6. Discussion",
      title:"Overgeneralized conclusion", excerpt:"These results demonstrate that section-aware summarization is the right approach for scientific reading and should replace generic summarizers in research tools.",
      comment:"A single 24-person study cannot “demonstrate” a field-wide prescription. Scope the claim to your evidence.",
      suggestion:"Our study provides preliminary evidence that section-aware summaries aid scientific reading; larger evaluations are needed before broad deployment.",
      rewrite:"Our study provides preliminary evidence that section-aware summaries aid scientific reading; larger evaluations are needed before broad deployment.",
      good:"Match the strength of the claim to the strength of the evidence." },
  ],
  visuals: [
    { id:"a7", kind:"figure", title:"Figure 1 — reader preference", cat:"format", sev:"minor",
      problem:"Means shown without any measure of spread; the reader can't tell whether the systems actually differ.",
      beforeLabel:"No error bars", afterLabel:"With 95% CI", fix:"Add confidence intervals and report n per condition.",
      beforePlot:{ type:"bars", yLabel:"Preference (1–7)", categories:["Bio","CS","Physics"],
        series:[ { name:"SciSumm", values:[5.8,5.4,5.1] }, { name:"BART-long", values:[4.6,4.5,4.2] } ] },
      afterPlot:{ type:"bars", yLabel:"Preference (1–7)", categories:["Bio","CS","Physics"],
        series:[ { name:"SciSumm", values:[5.8,5.4,5.1] }, { name:"BART-long", values:[4.6,4.5,4.2] } ],
        errors:[ [0.6,0.7,0.8], [0.6,0.5,0.7] ] } },
    { id:"a1", kind:"paragraph", title:"Abstract claim", cat:"writing", sev:"moderate",
      problem:"An unquantified superlative in the abstract.",
      before:"Our approach performs significantly better than existing baselines and produces summaries that readers strongly prefer.",
      after:"Readers rated SciSumm higher on usefulness and trust than both baselines (mean 5.4 vs. 4.4 on a 7-point scale).",
      metricBefore:"0 stats reported", metricAfter:"effect size + test" },
  ],
  related: [
    { title:"Hierarchical Attention for Long-Document Summarization", authors:"Chen, Duarte, Park", venue:"ACL 2023", sim:71, flag:"overlap", note:"Section-conditioned attention — your closest prior work." },
    { title:"Reading Between the Lines: Human Evaluation of Summaries", authors:"Novak et al.", venue:"CHI 2022", sim:44, flag:"related", note:"Protocol you can borrow for trust measures." },
    { title:"Longformer: The Long-Document Transformer", authors:"Beltagy, Peters, Cohan", venue:"arXiv 2020", sim:38, flag:"baseline", note:"Standard long-range attention baseline." },
    { title:"BART: Denoising Sequence-to-Sequence Pretraining", authors:"Lewis et al.", venue:"ACL 2020", sim:33, flag:"baseline", note:"The abstractive baseline you compare against." },
  ],
  missingRefs: [
    { for:"a2", text:"The STM Report: An Overview of Scientific and Scholarly Publishing, 5th ed.", reason:"Supports the two-million-articles claim." },
    { for:"a3", text:"Chen, Duarte & Park. Hierarchical Attention for Long-Document Summarization. ACL 2023.", reason:"Your closest methodological neighbour — must be compared, not just cited." },
    { text:"Fabbri et al. SummEval: Re-evaluating Summarization Evaluation. TACL 2021.", reason:"Frames the limits of ROUGE you allude to." },
  ],
  novelty: {
    score: 63, verdict:"Incremental over closest prior work",
    summary:"The section-aware idea overlaps substantially with Chen et al. (2023). The human-centered evaluation is the freshest contribution; foreground it and sharpen the technical delta.",
    strengths:["Human-centered evaluation is uncommon for scientific summarization","Section-routing head is a clean, testable mechanism","Reading-efficiency framing is well motivated"],
    risks:["Section-conditioned attention already exists (Chen 2023)","Technical novelty may read as engineering","Gains shown on a single small sample"] },
  report: {
    summary:"A well-motivated, readable paper whose core weakness is evidential: strong claims rest on a small single-department study with no inferential statistics, and the novelty over section-conditioned attention is thin. The human-centered angle is valuable and worth centering.",
    strengths:["Clear motivation and a sensible section-aware mechanism","Human-centered evaluation with comprehension and trust measures","Reading-efficiency results are intuitive and well presented"],
    weaknesses:["Claims of significance without any statistical test","Small, single-department sample limits external validity","Untested robustness-to-missing-abstract claim","Novelty overlap with Chen et al. (2023) not resolved"],
    minor:["Figure 1 lacks error bars","Unsupported two-million-articles statistic","Opaque loss-balancing hyperparameter"],
    recommendation:"minor", confidence:4 },
  references: [
    ref("r1","Beltagy, I., Peters, M. E., & Cohan, A. (2020). Longformer: The Long-Document Transformer. arXiv:2004.05150."),
    ref("r2","Lewis, M., et al. (2020). BART: Denoising Sequence-to-Sequence Pre-training. In Proc. ACL."),
    ref("r3","Chen, L., Duarte, R., & Park, S. (2023). Hierarchical Attention for Long-Document Summarization. In Proc. ACL."),
    ref("r4","Fabbri, A., et al. (2021). SummEval: Re-evaluating Summarization Evaluation. TACL, 9, 391–409."),
    ref("r5","Novak, J., Ill, S., & Weber, M. (2022). Reading Between the Lines: Human Evaluation of Summaries. In Proc. CHI."),
    ref("r6","Zhang, T., et al. (2020). PEGASUS: Pre-training with Gap-Sentences for Summarization. In Proc. ICML."),
    ref("r7","Cohan, A., et al. (2018). A Discourse-Aware Attention Model for Abstractive Summarization. In Proc. NAACL."),
    ref("r8","Kryściński, W., et al. (2020). Evaluating the Factual Consistency of Summaries. In Proc. EMNLP."),
    ref("r9","Nenkova, A., & McKeown, K. (2011). Automatic Summarization. Foundations and Trends in IR, 5(2–3)."),
    ref("r10","Card, S. K., Mackinlay, J., & Shneiderman, B. (1999). Readings in Information Visualization. Morgan Kaufmann."),
    ref("r11","Johnson, R., & Watkinson, A. (2018). The STM Report, 5th ed. International Association of STM Publishers."),
    ref("r12","See, A., Liu, P. J., & Manning, C. D. (2017). Get To The Point: Summarization with Pointer-Generator Networks. In Proc. ACL."),
  ],
};

/* ============================================================
   p2 — Federated Clinical Language Models (NeurIPS, ACCEPT)
   ERROR FAMILY: near-clean. Only a few minor polish notes — the
   contrast paper that shows what "good" looks like.
   ============================================================ */
const P2: ReviewBundle = {
  paper: {
    title: "Federated Fine-Tuning of Clinical Language Models Under Non-IID Data",
    authors: "K. Nakamura, S. Bauer",
    venue: "Submitted to NeurIPS 2025 · Datasets & Benchmarks",
    pages: 9, words: 7180, figures: 4, refs: 38,
    overall: 91, recommendation: "accept",
  },
  scores: { writing: 90, structure: 92, method: 90, logic: 91, novelty: 86, citation: 88, format: 93 },
  manuscript: [
    { type:"h1", section:"Abstract", runs:[t("Abstract")] },
    { type:"p", section:"Abstract", runs:[
      t("Clinical text cannot leave the hospital that produced it, yet clinical language models improve sharply with scale and diversity. We study federated fine-tuning of a clinical language model across ten simulated hospital sites with strongly non-IID label distributions. We introduce a site-normalized aggregation rule that reduces the accuracy gap between the most and least common conditions from 14 to 4 points while preserving a formal differential-privacy guarantee.") ] },

    { type:"h1", section:"1. Introduction", runs:[t("1. Introduction")] },
    { type:"p", section:"1. Introduction", runs:[
      t("Privacy regulation prevents pooling patient records, so models must be trained where the data lives. Federated learning addresses this, but clinical data is severely non-IID: a cardiology unit and a paediatric clinic see almost disjoint conditions. Naïve averaging then biases the model toward whichever sites are largest.") ] },
    { type:"p", section:"1. Introduction", runs:[
      t("We make three contributions. First, a benchmark of ten non-IID clinical sites derived from public discharge summaries. Second, a site-normalized aggregation rule that reweights updates by inverse label frequency. Third, a differential-privacy analysis giving an end-to-end (ε, δ) bound for the full training run.") ] },

    { type:"h1", section:"2. Related Work", runs:[t("2. Related Work")] },
    { type:"p", section:"2. Related Work", runs:[
      t("Federated averaging is the standard baseline for decentralized training, and subsequent work adds proximal terms and control variates to handle client drift. Differentially private federated learning composes per-round privacy costs across communication rounds. Our aggregation rule is complementary and can be layered on either family.") ] },

    { type:"h1", section:"3. Method", runs:[t("3. Method")] },
    { type:"p", section:"3. Method", runs:[
      t("Each site fine-tunes locally for one epoch and returns a clipped, noised update. The server aggregates updates weighted by inverse label frequency so that rare conditions are not drowned out by common ones. "),
      a("We add Gaussian noise calibrated to the clipping norm and report the resulting privacy budget in §5.", "b1"),
      t(" Aggregation is otherwise a drop-in replacement for federated averaging.") ] },

    { type:"h1", section:"4. Experiments", runs:[t("4. Experiments")] },
    { type:"p", section:"4. Experiments", runs:[
      t("We simulate ten sites with Dirichlet-partitioned labels at three heterogeneity levels and compare against federated averaging and a proximal variant. "),
      a("We use the standard federated averaging algorithm as our primary baseline.", "b2"),
      t(" All runs use identical local optimizers, clipping norms, and communication budgets; each configuration is repeated over five seeds and we report means with 95% confidence intervals.") ] },

    { type:"h1", section:"5. Results", runs:[t("5. Results")] },
    { type:"p", section:"5. Results", runs:[
      t("Site-normalized aggregation converges as fast as federated averaging on IID splits and markedly faster under strong heterogeneity (Figure 1). Per-site macro-F1 is more uniform (Figure 2), and the worst-performing site improves by nine points with no loss at the best site. The end-to-end guarantee is (ε = 3.1, δ = 1e-5).") ] },
    { type:"fig", section:"5. Results", fig:"fig1", anno:"", span:true,
      caption:"Figure 1. Validation macro-F1 vs. communication round under strong label heterogeneity. Bands are 95% CIs over five seeds.",
      plot:{ type:"line", xLabel:"Communication round", yLabel:"Macro-F1", x:[0,5,10,15,20,25],
        series:[ { name:"Site-normalized (ours)", values:[0.31,0.58,0.71,0.77,0.80,0.81] }, { name:"FedAvg", values:[0.30,0.47,0.58,0.64,0.68,0.70] }, { name:"FedProx", values:[0.30,0.51,0.62,0.68,0.71,0.73] } ] } },
    { type:"fig", section:"5. Results", fig:"fig2", anno:"", span:true,
      caption:"Figure 2. Per-site macro-F1 for four representative sites under two aggregation rules (higher and more uniform is better).",
      plot:{ type:"heatmap", xLabel:"Method", rows:["Site A","Site C","Site F","Site J"], cols:["FedAvg","Ours"],
        values:[[0.62,0.79],[0.71,0.82],[0.55,0.78],[0.68,0.80]] } },

    { type:"h1", section:"6. Discussion", runs:[t("6. Discussion")] },
    { type:"p", section:"6. Discussion", runs:[
      t("The gains come almost entirely from rebalancing rare conditions, which matters most in exactly the safety-critical long tail. Because the rule only changes aggregation weights, it inherits the convergence and privacy analyses of the underlying optimizer, which we make explicit in the appendix.") ] },

    { type:"h1", section:"7. Conclusion", runs:[t("7. Conclusion")] },
    { type:"p", section:"7. Conclusion", runs:[
      t("Site-normalized aggregation is a simple, drop-in change that narrows the accuracy gap across heterogeneous hospital sites while keeping a formal privacy guarantee. We release the benchmark, code, and trained checkpoints to support reproducible clinical federated learning.") ] },
  ],
  annotations: [
    { id:"b1", cat:"method", sev:"moderate", section:"3. Method",
      title:"State the privacy accountant", excerpt:"We add Gaussian noise calibrated to the clipping norm and report the resulting privacy budget in §5.",
      comment:"You report the final (ε, δ) but not how it's composed. Name the accountant (e.g. Rényi DP / moments accountant) so readers can verify the bound.",
      suggestion:"Add: “We compose per-round costs with the Rényi DP accountant (Mironov, 2017), yielding (ε = 3.1, δ = 1e-5).”",
      good:"A one-line accountant reference turns a stated bound into a checkable one." },
    { id:"b2", cat:"citation", sev:"minor", section:"4. Experiments",
      title:"Baseline uncited", excerpt:"We use the standard federated averaging algorithm as our primary baseline.",
      comment:"Federated averaging should carry a citation the first time it's named.",
      suggestion:"Cite McMahan et al. (2017) at first mention of federated averaging.",
      missingRef:"McMahan et al. Communication-Efficient Learning of Deep Networks from Decentralized Data. AISTATS 2017." },
    { id:"b3", cat:"writing", sev:"minor", section:"1. Introduction",
      title:"Long sentence, split for clarity", excerpt:"Privacy regulation prevents pooling patient records, so models must be trained where the data lives.",
      comment:"This is fine, but the following sentence packs three clauses; consider splitting for rhythm.",
      suggestion:"Federated learning addresses this. But clinical data is severely non-IID: a cardiology unit and a paediatric clinic see almost disjoint conditions.",
      rewrite:"Federated learning addresses this. But clinical data is severely non-IID: a cardiology unit and a paediatric clinic see almost disjoint conditions.",
      good:"Short sentences read faster in dense methods prose." },
  ],
  visuals: [
    { id:"b3", kind:"paragraph", title:"Intro sentence rhythm", cat:"writing", sev:"minor",
      problem:"A three-clause sentence that could be split.",
      before:"Federated learning addresses this, but clinical data is severely non-IID: a cardiology unit and a paediatric clinic see almost disjoint conditions.",
      after:"Federated learning addresses this. But clinical data is severely non-IID: a cardiology unit and a paediatric clinic see almost disjoint conditions.",
      metricBefore:"1 long sentence", metricAfter:"2 clear sentences" },
  ],
  related: [
    { title:"Communication-Efficient Learning from Decentralized Data", authors:"McMahan et al.", venue:"AISTATS 2017", sim:40, flag:"baseline", note:"Federated averaging — your primary baseline." },
    { title:"Federated Optimization in Heterogeneous Networks", authors:"Li et al.", venue:"MLSys 2020", sim:37, flag:"related", note:"FedProx; your proximal comparison." },
    { title:"Rényi Differential Privacy", authors:"Mironov", venue:"CSF 2017", sim:29, flag:"related", note:"The accountant to cite for your bound." },
  ],
  missingRefs: [
    { for:"b2", text:"McMahan et al. Communication-Efficient Learning of Deep Networks from Decentralized Data. AISTATS 2017.", reason:"Federated averaging is named but not cited." },
  ],
  novelty: {
    score: 86, verdict:"Clear, useful contribution",
    summary:"A simple aggregation change with a real effect on the long tail, plus a released non-IID clinical benchmark and an end-to-end privacy bound. Novelty is modest but the package is complete and well-executed.",
    strengths:["Released non-IID clinical benchmark","Formal end-to-end privacy guarantee","Drop-in rule that layers on existing optimizers"],
    risks:["Aggregation reweighting is conceptually simple","Gains are concentrated in the rare-label regime"] },
  report: {
    summary:"A clean, complete, and honest paper: a simple idea, a released benchmark, careful experiments with confidence intervals, and a formal privacy bound. Only cosmetic issues remain.",
    strengths:["Simple, well-motivated aggregation rule with clear gains on the long tail","Released benchmark, code, and checkpoints","Careful experiments with seeds and confidence intervals","Formal (ε, δ) guarantee"],
    weaknesses:["Novelty is modest relative to the aggregation-rule literature"],
    minor:["Name the privacy accountant explicitly","Cite federated averaging at first mention","One long sentence in the introduction"],
    recommendation:"accept", confidence:5 },
  references: [
    ref("r1","McMahan, B., et al. (2017). Communication-Efficient Learning of Deep Networks from Decentralized Data. In Proc. AISTATS."),
    ref("r2","Li, T., et al. (2020). Federated Optimization in Heterogeneous Networks. In Proc. MLSys."),
    ref("r3","Karimireddy, S. P., et al. (2020). SCAFFOLD: Stochastic Controlled Averaging for Federated Learning. In Proc. ICML."),
    ref("r4","Mironov, I. (2017). Rényi Differential Privacy. In Proc. IEEE CSF."),
    ref("r5","Abadi, M., et al. (2016). Deep Learning with Differential Privacy. In Proc. ACM CCS."),
    ref("r6","Alsentzer, E., et al. (2019). Publicly Available Clinical BERT Embeddings. In Proc. Clinical NLP Workshop."),
    ref("r7","Johnson, A. E. W., et al. (2016). MIMIC-III, a Freely Accessible Critical Care Database. Scientific Data, 3."),
    ref("r8","Kairouz, P., et al. (2021). Advances and Open Problems in Federated Learning. FnT ML, 14(1–2)."),
    ref("r9","Hsu, T.-M. H., et al. (2019). Measuring the Effects of Non-Identical Data Distribution. arXiv:1909.06335."),
    ref("r10","Reddi, S., et al. (2021). Adaptive Federated Optimization. In Proc. ICLR."),
    ref("r11","Dwork, C., & Roth, A. (2014). The Algorithmic Foundations of Differential Privacy. FnT TCS, 9(3–4)."),
    ref("r12","Wang, H., et al. (2020). Federated Learning with Matched Averaging. In Proc. ICLR."),
  ],
};

/* ============================================================
   p3 — Tactile Feedback for Mid-Air Gesture Menus (UIST, MAJOR)
   ERROR FAMILY: experimental design / internal validity + figure
   hygiene + structure. Confound / no counterbalancing, an over-
   generalized claim, a mislabeled figure axis, and an un-enumerated
   contributions list.
   ============================================================ */
const P3: ReviewBundle = {
  paper: {
    title: "Tactile Feedback for Mid-Air Gesture Menus",
    authors: "D. Owusu, E. Lindqvist, J. Carter",
    venue: "Submitted to UIST 2025 · Papers",
    pages: 11, words: 8120, figures: 5, refs: 33,
    overall: 74, recommendation: "major",
  },
  scores: { writing: 82, structure: 68, method: 61, logic: 66, novelty: 85, citation: 74, format: 70 },
  manuscript: [
    { type:"h1", section:"Abstract", runs:[t("Abstract")] },
    { type:"p", section:"Abstract", runs:[
      t("Mid-air gesture menus are fast but error-prone because the hand receives no contact feedback. We present HaptRing, a wrist-worn actuator that delivers directional tactile cues as a user traverses a radial menu. In a study with 18 participants, tactile feedback reduced selection errors and was strongly preferred over the no-feedback baseline.") ] },

    { type:"h1", section:"1. Introduction", runs:[t("1. Introduction")] },
    { type:"p", section:"1. Introduction", runs:[
      t("Freehand menus let users act at a distance, but without the tactile confirmation of a button press, selections drift and users over-correct. Prior systems add audio or visual cues, which compete with the primary task for attention. Tactile cues are attractive because they are private and off the visual channel.") ] },
    { type:"p", section:"1. Introduction", runs:[
      t("We designed HaptRing to test whether directional vibration at the wrist can substitute for the missing sense of contact. The paper describes the device, a controlled study, and design guidance for tactile menu feedback.") ] },

    { type:"h1", section:"2. Related Work", runs:[t("2. Related Work")] },
    { type:"p", section:"2. Related Work", runs:[
      t("Mid-air interaction has a long history in HCI, and radial (marking) menus are known to support fast, eyes-free selection. "),
      a("Wearable haptics has explored wrist and finger actuation for notification and guidance.", "c6"),
      t(" We build on this work by mapping actuator direction to menu geometry rather than using undirected buzzes.") ] },

    { type:"h1", section:"3. System", runs:[t("3. System")] },
    { type:"p", section:"3. System", runs:[
      t("HaptRing places four coin actuators around the wrist and fires the actuator nearest the target sector as the hand enters it. A depth camera tracks the hand and drives the menu state machine. Before each session the haptic actuators were calibrated per-session to each participant's comfortable intensity. Latency from gesture to vibration is under 30 ms.") ] },

    { type:"h1", section:"4. Study", runs:[t("4. Study")] },
    { type:"p", section:"4. Study", runs:[
      t("Eighteen participants completed 240 selections each on an eight-item radial menu, first without feedback and then with HaptRing. "),
      a("Every participant performed the no-feedback condition first, followed by the tactile condition.", "c1"),
      t(" We recorded error rate, selection time, and post-condition preference. Sessions lasted about 40 minutes.") ] },
    { type:"p", section:"4. Study", runs:[
      a("We did not include a limitations or threats-to-validity section, as the effects were consistent across participants.", "c4") ] },

    { type:"h1", section:"5. Results", runs:[t("5. Results")] },
    { type:"p", section:"5. Results", runs:[
      t("Selection time fell under tactile feedback and the spread narrowed (Figure 1). Accuracy rose with stronger actuation up to a point (Figure 2). Preference was near-unanimous: 16 of 18 participants chose HaptRing.") ] },
    { type:"fig", section:"5. Results", fig:"fig1", anno:"", span:true,
      caption:"Figure 1. Selection time (seconds) by condition. Boxes show quartiles; whiskers show min/max across 18 participants.",
      plot:{ type:"box", yLabel:"Selection time (s)",
        groups:[ { name:"No feedback", min:0.9, q1:1.4, median:1.9, q3:2.4, max:3.6 }, { name:"HaptRing", min:0.7, q1:1.0, median:1.3, q3:1.7, max:2.4 } ] } },
    { type:"fig", section:"5. Results", fig:"fig2", anno:"c3", span:true,
      caption:"Figure 2. Selection accuracy vs. feedback strength. Each point is one participant.",
      plot:{ type:"scatter", xLabel:"Trial number", yLabel:"Accuracy (%)", trend:true,
        series:[ { name:"Participants", points:[[1.0,72],[1.5,78],[2.0,83],[2.5,86],[3.0,90],[3.5,91],[4.0,93],[2.2,84],[3.1,88],[1.8,80]] } ] } },
    { type:"p", section:"5. Results", runs:[
      a("These results show that wrist-worn tactile feedback improves mid-air menu selection for any menu size or layout.", "c2"),
      t(" We expect the benefit to transfer directly to virtual- and augmented-reality menus.") ] },

    { type:"h1", section:"6. Discussion", runs:[t("6. Discussion")] },
    { type:"p", section:"6. Discussion", runs:[
      a("The strong improvement we observed may reflect learning and order effects as much as the feedback itself.", "c5"),
      t(" Directional cues appeared to help most on the diagonal sectors, where visual disambiguation is hardest. Designers should map actuator direction to menu geometry rather than using a generic confirmation buzz.") ] },

    { type:"h1", section:"7. Conclusion", runs:[t("7. Conclusion")] },
    { type:"p", section:"7. Conclusion", runs:[
      t("HaptRing shows that directional wrist haptics can stand in for the missing sense of contact in mid-air menus. A counterbalanced, larger study is needed to separate the feedback effect from practice, and to test whether the benefit holds across menu sizes.") ] },
  ],
  annotations: [
    { id:"c1", cat:"method", sev:"critical", section:"4. Study",
      title:"Uncounterbalanced order confounds the result", excerpt:"Every participant performed the no-feedback condition first, followed by the tactile condition.",
      comment:"Because condition order is fixed, any improvement is confounded with practice and fatigue. The tactile condition always benefits from warm-up. This is the study's central threat.",
      suggestion:"Counterbalance condition order (or use a Latin square) and analyze order as a factor.",
      good:"Counterbalancing is the cheapest way to rule out an order effect." },
    { id:"c2", cat:"logic", sev:"critical", section:"5. Results",
      title:"Overgeneralized beyond the tested design", excerpt:"These results show that wrist-worn tactile feedback improves mid-air menu selection for any menu size or layout.",
      comment:"You tested one eight-item radial menu. “Any menu size or layout” is not supported and directly contradicts your own call for further study in §7.",
      suggestion:"Scope to the tested design: “improves selection on an eight-item radial menu,” and flag generalization as future work." },
    { id:"c3", cat:"format", sev:"moderate", section:"5. Results", isFigure:true,
      title:"Figure 2 x-axis is mislabeled", excerpt:"Selection accuracy vs. feedback strength. Each point is one participant.",
      comment:"The caption says the x-axis is feedback strength, but the axis is labeled “Trial number.” A mislabeled axis makes the figure uninterpretable and undermines trust in the analysis.",
      suggestion:"Relabel the x-axis to “Feedback strength (normalized)” to match the caption, or fix the caption to match the data." },
    { id:"c4", cat:"structure", sev:"moderate", section:"4. Study",
      title:"No limitations / threats-to-validity", excerpt:"We did not include a limitations or threats-to-validity section, as the effects were consistent across participants.",
      comment:"Consistency across participants does not address internal-validity threats (order, learning, calibration). A limitations section is expected at this venue.",
      suggestion:"Add a Threats to Validity section covering order effects, sample size, and single-session design." },
    { id:"c5", cat:"method", sev:"moderate", section:"6. Discussion",
      title:"Effect may be learning, not feedback", excerpt:"The strong improvement we observed may reflect learning and order effects as much as the feedback itself.",
      comment:"Good that you acknowledge this — but it means the headline claim is not yet supported. Elevate this to the abstract and temper the contribution accordingly.",
      suggestion:"Report a practice-controlled analysis, or explicitly frame the result as preliminary pending a counterbalanced study." },
    { id:"c6", cat:"citation", sev:"moderate", section:"2. Related Work",
      title:"Missing key wearable-haptics reference", excerpt:"Wearable haptics has explored wrist and finger actuation for notification and guidance.",
      comment:"This sentence summarizes a body of work with no citations. Anchor it to the foundational wrist-haptics guidance papers.",
      suggestion:"Cite the canonical wrist/skin-stretch guidance work here.",
      missingRef:"Pasquero & Hayward. Haptic feedback for mobile interaction. (survey)." },
    { id:"c7", cat:"writing", sev:"minor", section:"1. Introduction",
      title:"Jargon without unpacking", excerpt:"selections drift and users over-correct",
      comment:"“Drift” and “over-correct” are intuitive to you but vague to a general HCI reader. One concrete example would ground them.",
      suggestion:"Add a concrete example: “the cursor overshoots the intended sector and the user swings back, often selecting a neighbour.”",
      rewrite:"the cursor overshoots the intended sector and the user swings back, often selecting a neighbouring item",
      good:"Concrete beats abstract in a motivation paragraph." },
  ],
  visuals: [
    { id:"c3", kind:"figure", title:"Figure 2 — axis mismatch", cat:"format", sev:"moderate",
      problem:"The caption describes feedback strength, but the x-axis is labeled “Trial number.”",
      beforeLabel:"x: Trial number", afterLabel:"x: Feedback strength", fix:"Relabel the axis to match the caption (or fix the caption).",
      beforePlot:{ type:"scatter", xLabel:"Trial number", yLabel:"Accuracy (%)", trend:true,
        series:[ { name:"Participants", points:[[1.0,72],[1.5,78],[2.0,83],[2.5,86],[3.0,90],[3.5,91],[4.0,93]] } ] },
      afterPlot:{ type:"scatter", xLabel:"Feedback strength (normalized)", yLabel:"Accuracy (%)", trend:true,
        series:[ { name:"Participants", points:[[1.0,72],[1.5,78],[2.0,83],[2.5,86],[3.0,90],[3.5,91],[4.0,93]] } ] } },
    { id:"c7", kind:"paragraph", title:"Vague motivation", cat:"writing", sev:"minor",
      problem:"Abstract verbs where a concrete example would land harder.",
      before:"selections drift and users over-correct",
      after:"the cursor overshoots the intended sector and the user swings back, often selecting a neighbouring item",
      metricBefore:"abstract", metricAfter:"concrete example" },
  ],
  related: [
    { title:"Marking Menus for Eyes-Free Selection", authors:"Kurtenbach & Buxton", venue:"CHI 1993", sim:34, flag:"related", note:"Radial-menu foundations you build on." },
    { title:"Skin-Stretch Haptics for Directional Guidance", authors:"Bark et al.", venue:"IEEE ToH 2010", sim:41, flag:"related", note:"Directional wrist haptics — cite in Related Work." },
    { title:"Around-Device Haptics for Mid-Air Input", authors:"Sodhi et al.", venue:"UIST 2013", sim:38, flag:"related", note:"Contactless feedback alternative to compare." },
  ],
  missingRefs: [
    { for:"c6", text:"Bark, K., et al. Skin-Stretch Feedback for Directional Guidance. IEEE Transactions on Haptics, 2010.", reason:"Directly supports the wrist-actuation claim." },
    { text:"Kurtenbach, G., & Buxton, W. The Limits of Expert Performance Using Marking Menus. CHI 1993.", reason:"Foundational radial-menu reference." },
  ],
  novelty: {
    score: 85, verdict:"Fresh device and mapping",
    summary:"Mapping actuator direction to menu geometry is a genuinely novel and useful idea. The contribution is limited less by novelty than by the study design that supports it.",
    strengths:["Directional actuator-to-geometry mapping is new","Low-latency wearable prototype","Clear, motivated design guidance"],
    risks:["Single menu design tested","Result confounded by fixed condition order"] },
  report: {
    summary:"A creative device with a promising result undercut by internal-validity problems. Fixed condition order confounds the headline effect, a central claim overgeneralizes, and a figure axis is mislabeled. The idea is strong enough to merit a rigorous re-run.",
    strengths:["Novel directional wrist-haptics mapping","Working low-latency prototype","Near-unanimous participant preference"],
    weaknesses:["Uncounterbalanced condition order confounds the main effect","Central claim overgeneralizes beyond the one tested menu","No limitations / threats-to-validity section"],
    minor:["Figure 2 x-axis mislabeled","Wearable-haptics claim uncited","Vague motivation verbs"],
    recommendation:"major", confidence:4 },
  references: [
    ref("r1","Kurtenbach, G., & Buxton, W. (1993). The Limits of Expert Performance Using Marking Menus. In Proc. CHI."),
    ref("r2","Bark, K., et al. (2010). Skin-Stretch Feedback for Directional Guidance. IEEE Trans. Haptics, 3(3)."),
    ref("r3","Sodhi, R., et al. (2013). AIREAL: Interactive Tactile Experiences in Free Air. In Proc. UIST."),
    ref("r4","Pasquero, J., & Hayward, V. (2011). Haptic Feedback for Mobile Interaction. (Survey)."),
    ref("r5","Weinberg, G., et al. (2007). ZeroTouch: Mid-Air Gesture Sensing. In Proc. CHI."),
    ref("r6","Gustafson, S., et al. (2011). Imaginary Interfaces. In Proc. UIST."),
    ref("r7","Lee, J., et al. (2018). Wearable Directional Haptics for Navigation. In Proc. CHI."),
    ref("r8","Kim, Y., et al. (2019). Wrist-Worn Haptics: A Survey. IEEE Trans. Haptics, 12(4)."),
    ref("r9","MacKenzie, I. S. (1992). Fitts' Law as a Research and Design Tool in HCI. HCI, 7(1)."),
    ref("r10","Vermeulen, J., et al. (2013). Crossing the Boundaries of Feedback. In Proc. CHI."),
  ],
};

/* ============================================================
   p5 — LLM-Assisted Code Review: A Field Study (ICSE, REJECT)
   ERROR FAMILY: reproducibility + structure + writing + novelty.
   No control group, correlation treated as causation, missing
   Threats-to-Validity and Conclusion, vague prose, no data
   availability, and a novelty overlap.
   ============================================================ */
const P5: ReviewBundle = {
  paper: {
    title: "LLM-Assisted Code Review: A Field Study at Scale",
    authors: "R. Hassan, T. Mbeki",
    venue: "Submitted to ICSE 2026 · Technical Track",
    pages: 13, words: 9640, figures: 4, refs: 29,
    overall: 57, recommendation: "reject",
  },
  scores: { writing: 58, structure: 46, method: 52, logic: 49, novelty: 55, citation: 62, format: 74 },
  manuscript: [
    { type:"h1", section:"Abstract", runs:[t("Abstract")] },
    { type:"p", section:"Abstract", runs:[
      t("We deployed an LLM-based code-review assistant across 40 engineering teams for twelve weeks. "),
      a("Our tool dramatically improves code quality and makes review much more efficient.", "d1"),
      t(" Teams that adopted the assistant merged fewer defects and reported higher satisfaction. We conclude that LLM assistance should become standard practice in industrial code review.") ] },

    { type:"h1", section:"1. Introduction", runs:[t("1. Introduction")] },
    { type:"p", section:"1. Introduction", runs:[
      t("Code review is expensive and inconsistent. Large language models can now read diffs and suggest issues, raising the prospect of automated first-pass review. We study what happens when such a tool is deployed in a real organization rather than a benchmark.") ] },

    { type:"h1", section:"2. Related Work", runs:[t("2. Related Work")] },
    { type:"p", section:"2. Related Work", runs:[
      a("Prior work has applied language models to code review suggestions.", "d2"),
      t(" We differ by studying deployment at scale. Empirical software-engineering studies have long "),
      a("measured review effectiveness through defect escape rates and participant surveys.", "d8") ] },

    { type:"h1", section:"3. Study Design", runs:[t("3. Study Design")] },
    { type:"p", section:"3. Study Design", runs:[
      t("The assistant was made available to 40 teams; adoption was voluntary. "),
      a("We compared defect rates before and after teams turned the assistant on.", "d3"),
      t(" Usage telemetry, merged-defect counts, and a satisfaction survey were collected weekly.") ] },
    { type:"p", section:"3. Study Design", runs:[
      a("Teams that adopted the assistant earliest showed the largest quality gains, indicating that the tool drives quality.", "d5"),
      t(" We did not assign teams to conditions; each team chose whether and when to enable the assistant.") ] },

    { type:"h1", section:"4. Results", runs:[t("4. Results")] },
    { type:"p", section:"4. Results", runs:[
      t("Across the deployment, adopting teams caught more defects per review than they had previously, concentrated in null-handling and error-path categories (Figure 1). Adoption rose steadily over the twelve weeks (Figure 2).") ] },
    { type:"fig", section:"4. Results", fig:"fig1", anno:"", span:true,
      caption:"Figure 1. Defects caught per 100 reviews by category: unassisted human review vs. LLM-assisted.",
      plot:{ type:"bars", yLabel:"Defects / 100 reviews", categories:["Null","Error path","Style","Logic","Security"],
        series:[ { name:"Human only", values:[3.1,2.4,6.8,1.9,0.8] }, { name:"LLM-assisted", values:[5.6,4.7,7.1,2.6,1.9] } ] } },
    { type:"fig", section:"4. Results", fig:"fig2", anno:"", span:true,
      caption:"Figure 2. Weekly assistant adoption (share of teams with the assistant enabled).",
      plot:{ type:"line", xLabel:"Week", yLabel:"Teams enabled (%)", x:[1,3,5,7,9,11],
        series:[ { name:"Adoption", values:[8,18,31,45,58,70] } ] } },
    { type:"p", section:"4. Results", runs:[
      a("The correlation between assistant usage and defect reduction was strong, so the assistant caused the improvement in code quality.", "d4"),
      t(" Satisfaction scores rose in parallel with usage.") ] },

    { type:"h1", section:"5. Discussion", runs:[t("5. Discussion")] },
    { type:"p", section:"5. Discussion", runs:[
      a("The assistant clearly works and organizations should adopt it broadly.", "d6"),
      t(" Reviewers told us the suggestions were most useful on unfamiliar code. "),
      a("Our telemetry and survey data cannot be shared for confidentiality reasons.", "d7") ] },
  ],
  annotations: [
    { id:"d1", cat:"writing", sev:"moderate", section:"Abstract",
      title:"Vague, unquantified claim", excerpt:"Our tool dramatically improves code quality and makes review much more efficient.",
      comment:"“Dramatically” and “much more efficient” carry no numbers. Lead the abstract with the actual measured effect.",
      suggestion:"Adopting teams caught 46% more defects per review (5.6 vs. 3.1 per 100 reviews for null-handling) over twelve weeks.",
      rewrite:"Adopting teams caught 46% more defects per review (5.6 vs. 3.1 per 100 reviews for null-handling) over twelve weeks.",
      good:"An abstract's job is to report the effect, not to praise the tool." },
    { id:"d2", cat:"novelty", sev:"critical", section:"2. Related Work", overlap:63,
      title:"Novelty overlap not resolved", excerpt:"Prior work has applied language models to code review suggestions.",
      comment:"Several recent systems already apply LLMs to review suggestions. “We differ by studying deployment at scale” needs a concrete contrast — what does the field study show that a benchmark cannot?",
      suggestion:"Name the closest 2–3 systems and state precisely what your deployment reveals that prior evaluations did not." },
    { id:"d3", cat:"method", sev:"critical", section:"3. Study Design",
      title:"No control group", excerpt:"We compared defect rates before and after teams turned the assistant on.",
      comment:"A before/after comparison with voluntary adoption has no control. Secular trends, tooling changes, or release cycles could produce the same effect. Without a control or a matched comparison you cannot attribute the change to the assistant.",
      suggestion:"Add a matched comparison group (teams that never enabled the assistant) or use a staggered-adoption difference-in-differences design.",
      good:"A control group is what separates a field study from a testimonial." },
    { id:"d4", cat:"logic", sev:"critical", section:"4. Results",
      title:"Correlation asserted as causation", excerpt:"The correlation between assistant usage and defect reduction was strong, so the assistant caused the improvement in code quality.",
      comment:"This is the paper's central logical error. Voluntary adopters differ systematically from non-adopters (motivation, seniority), so correlation cannot establish cause here.",
      suggestion:"Report the association without the causal leap, and use a design (DiD, instrumented adoption) that can support a causal claim." },
    { id:"d5", cat:"method", sev:"moderate", section:"3. Study Design",
      title:"Selection bias from voluntary adoption", excerpt:"Teams that adopted the assistant earliest showed the largest quality gains, indicating that the tool drives quality.",
      comment:"Early adopters are precisely the teams most invested in quality. Their gains likely reflect who they are, not what the tool did.",
      suggestion:"Model adoption as endogenous, or compare within-team before/after against a non-adopting matched set." },
    { id:"d6", cat:"writing", sev:"moderate", section:"5. Discussion",
      title:"Unsupported prescription", excerpt:"The assistant clearly works and organizations should adopt it broadly.",
      comment:"“Clearly works” overstates an uncontrolled result, and a broad adoption prescription doesn't follow from it.",
      suggestion:"Scope the takeaway to what the data support and list the conditions under which the tool helped." },
    { id:"d7", cat:"structure", sev:"moderate", section:"5. Discussion",
      title:"No data availability; paper ends abruptly", excerpt:"Our telemetry and survey data cannot be shared for confidentiality reasons.",
      comment:"The paper stops after Discussion — there is no Threats to Validity and no Conclusion — and no reproducibility path (no anonymized data, aggregate statistics, or materials). Both are expected at this venue.",
      suggestion:"Add Threats to Validity and Conclusion sections, and release aggregate statistics, survey instruments, and analysis code even if raw logs are confidential." },
    { id:"d8", cat:"citation", sev:"moderate", section:"2. Related Work",
      title:"Empirical-SE methods uncited", excerpt:"measured review effectiveness through defect escape rates and participant surveys",
      comment:"You invoke established empirical-SE methodology without citing it. Ground the metrics in the methods literature.",
      suggestion:"Cite foundational defect-escape and code-review effectiveness studies (e.g. Bacchelli & Bird, 2013).",
      missingRef:"Bacchelli, A., & Bird, C. Expectations, Outcomes, and Challenges of Modern Code Review. ICSE 2013." },
  ],
  visuals: [
    { id:"d1", kind:"paragraph", title:"Abstract overclaim", cat:"writing", sev:"moderate",
      problem:"Praise instead of a measured effect.",
      before:"Our tool dramatically improves code quality and makes review much more efficient.",
      after:"Adopting teams caught 46% more defects per review (5.6 vs. 3.1 per 100 reviews) over twelve weeks.",
      metricBefore:"0 numbers", metricAfter:"quantified effect" },
    { id:"d4", kind:"paragraph", title:"Causal leap", cat:"logic", sev:"critical",
      problem:"A strong correlation is treated as proof of causation.",
      before:"The correlation was strong, so the assistant caused the improvement in code quality.",
      after:"Usage was strongly associated with fewer merged defects; a controlled design is needed to test causation.",
      metricBefore:"correlation → cause", metricAfter:"association, cause untested" },
  ],
  related: [
    { title:"Expectations, Outcomes, and Challenges of Modern Code Review", authors:"Bacchelli & Bird", venue:"ICSE 2013", sim:44, flag:"related", note:"Foundational method reference you should cite." },
    { title:"Automating Code Review Suggestions with LLMs", authors:"Ito et al.", venue:"FSE 2024", sim:63, flag:"overlap", note:"Closest prior LLM-review system — resolve the novelty overlap." },
    { title:"Difference-in-Differences in Software Engineering", authors:"Nguyen et al.", venue:"EMSE 2022", sim:31, flag:"related", note:"A design that could rescue your causal claim." },
  ],
  missingRefs: [
    { for:"d8", text:"Bacchelli, A., & Bird, C. Expectations, Outcomes, and Challenges of Modern Code Review. ICSE 2013.", reason:"Anchors your effectiveness metrics." },
    { for:"d2", text:"Ito, K., et al. Automating Code Review Suggestions with Large Language Models. FSE 2024.", reason:"Your closest prior system." },
    { text:"Angrist, J., & Pischke, J.-S. Mostly Harmless Econometrics. Princeton, 2009.", reason:"Standard reference for identifying causal effects from observational data." },
  ],
  novelty: {
    score: 55, verdict:"Overlaps recent LLM-review work",
    summary:"The scale of the deployment is genuinely interesting, but the technical idea overlaps recent systems and the study design cannot support the causal contribution it claims. The field-study angle needs an identification strategy to be novel in substance.",
    strengths:["Real twelve-week industrial deployment","Meaningful scale (40 teams)"],
    risks:["Overlap with recent LLM-review systems","No control group or identification strategy","Selection bias from voluntary adoption"] },
  report: {
    summary:"An ambitious deployment undermined by an uncontrolled design and a causal claim it cannot support. Voluntary adoption plus a before/after comparison confounds the effect with who chose to adopt; the paper also omits Threats to Validity and a Conclusion and shares no reproducible materials. Interesting data, but the inferences are not yet defensible.",
    strengths:["Rare at-scale industrial field deployment","Consistent, plausibly useful defect-category effects","Twelve weeks of longitudinal telemetry"],
    weaknesses:["No control group; before/after with voluntary adoption","Correlation asserted as causation","Selection bias among early adopters","Missing Threats to Validity and Conclusion; no reproducible materials"],
    minor:["Abstract overclaims without numbers","Novelty overlap with recent LLM-review systems","Empirical-SE metrics uncited"],
    recommendation:"reject", confidence:4 },
  references: [
    ref("r1","Bacchelli, A., & Bird, C. (2013). Expectations, Outcomes, and Challenges of Modern Code Review. In Proc. ICSE."),
    ref("r2","Ito, K., et al. (2024). Automating Code Review Suggestions with Large Language Models. In Proc. FSE."),
    ref("r3","Nguyen, T., et al. (2022). Difference-in-Differences Designs in Software Engineering. EMSE, 27(4)."),
    ref("r4","Rigby, P. C., & Bird, C. (2013). Convergent Contemporary Software Peer Review Practices. In Proc. FSE."),
    ref("r5","McIntosh, S., et al. (2014). The Impact of Code Review Coverage and Participation. In Proc. MSR."),
    ref("r6","Sadowski, C., et al. (2018). Modern Code Review: A Case Study at Google. In Proc. ICSE-SEIP."),
    ref("r7","Angrist, J., & Pischke, J.-S. (2009). Mostly Harmless Econometrics. Princeton University Press."),
    ref("r8","Chen, M., et al. (2021). Evaluating Large Language Models Trained on Code. arXiv:2107.03374."),
    ref("r9","Tufano, R., et al. (2022). Using Pre-Trained Models to Support Code Review. In Proc. ICSE."),
    ref("r10","Shull, F., et al. (2008). Guide to Advanced Empirical Software Engineering. Springer."),
  ],
};

/* every reviewable paper resolves to its own bundle */
export const BUNDLES: Record<string, ReviewBundle> = { p1: P1, p2: P2, p3: P3, p5: P5 };

/* ---- Seeded revision history (p3) ----------------------------------------
   A deterministic v1→v2 demo for the compare view. v2 is the current P3
   review; v1 is an earlier, weaker snapshot that still carried two issues
   (g1/g2) which were resolved before v2 — so the compare shows two issues
   cleared and every category score improved. */
const P3_V1: ReviewBundle = {
  ...P3,
  paper: { ...P3.paper, overall: 61 },
  scores: { writing: 74, structure: 58, method: 50, logic: 55, novelty: 82, citation: 66, format: 60 },
  annotations: [
    ...P3.annotations,
    { id:"g1", cat:"structure", sev:"moderate", section:"1. Introduction",
      title:"Contributions not enumerated", excerpt:"The introduction ends without a clear list of contributions.",
      comment:"Reviewers scan for an explicit contributions list; add three bullet points." },
    { id:"g2", cat:"method", sev:"critical", section:"3. System",
      title:"Calibration procedure undocumented", excerpt:"Before each session the haptic actuators were calibrated per-session",
      comment:"The per-session calibration is mentioned but never specified — report the protocol so the study is reproducible." },
  ],
};

const p3Versions: PaperVersion[] = [
  { id:"v1", label:"v1 · initial submission", createdAt: 1781697600000, score: 61, openIssues: 9, bundle: P3_V1 },
  { id:"v2", label:"v2 · current", createdAt: 1783252800000, score: 74, openIssues: 7, bundle: P3 },
];

// ---- Library (dashboard) -------------------------------------------------------
export const LIBRARY: LibraryPaper[] = [
  { id:"p1", title:"Attention-Guided Summarization of Long Scientific Documents", authors:"Reyes, Tanaka, Okafor, Singh", venue:"CHI 2026",        status:"in-review", score:78,   issues:9, updated:"2 hours ago", updatedAt:1783504800000 },
  { id:"p2", title:"Federated Fine-Tuning of Clinical Language Models",           authors:"Nakamura, Bauer",              venue:"NeurIPS 2025",     status:"done",      score:91,   issues:3, updated:"Yesterday",   updatedAt:1783425600000 },
  { id:"p3", title:"Tactile Feedback for Mid-Air Gesture Menus",                  authors:"Owusu, Lindqvist, Carter",     venue:"UIST 2025",        status:"done",      score:74,   issues:7, updated:"3 days ago", updatedAt:1783252800000, versions:p3Versions },
  { id:"p4", title:"A Survey of Differential Privacy in Recommender Systems",     authors:"Petrova et al.",               venue:"ACM Comput. Surv.", status:"draft",     score:null, issues:0, updated:"5 days ago", updatedAt:1783080000000 },
  { id:"p5", title:"LLM-Assisted Code Review: A Field Study at Scale",            authors:"Hassan, Mbeki",                venue:"ICSE 2026",        status:"done",      score:57,   issues:8, updated:"1 week ago", updatedAt:1782907200000 },
];

// ---- Analyzing pipeline steps ----------------------------------------------------
export const PIPELINE: PipelineStep[] = [
  { label:"Parsing manuscript", detail:"sections, figures & references" },
  { label:"Assessing writing & structure", detail:"section rhetoric, readability" },
  { label:"Auditing methodology & logic", detail:"claims vs. evidence" },
  { label:"Cross-referencing literature", detail:"2.1M papers · novelty check" },
  { label:"Verifying citations", detail:"references resolved" },
  { label:"Drafting review report", detail:"structured, editable" },
];
