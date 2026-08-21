/* ============================================================
   Margin — review report export (Markdown download + print PDF)
   ============================================================ */
import type { Annotation, ReviewBundle } from "../services/types";
import { RECS } from "../data/mock";

export function buildMarkdown(bundle: ReviewBundle, overrides?: {
  recommendation?: keyof typeof RECS; confidence?: number; summary?: string;
  userNotes?: Annotation[];
}): string {
  const { paper, report } = bundle;
  const rec = overrides?.recommendation ?? report.recommendation;
  const conf = overrides?.confidence ?? report.confidence;
  const summary = overrides?.summary ?? report.summary;
  const userNotes = overrides?.userNotes ?? [];
  const bullets = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  const notesSection = userNotes.length
    ? `

## 5. Reviewer's own notes

${userNotes.map((n) => `- **${n.title}**${n.excerpt ? ` — "${n.excerpt.trim()}"` : ""}${n.comment ? `: ${n.comment}` : ""}`).join("\n")}`
    : "";
  return `# Review report

**Paper:** ${paper.title}
**Authors:** ${paper.authors}
**Venue:** ${paper.venue}

**Recommendation:** ${RECS[rec].label}
**Reviewer confidence:** ${conf} / 5

## 1. Summary

${summary}

## 2. Strengths

${bullets(report.strengths)}

## 3. Weaknesses

${bullets(report.weaknesses)}

## 4. Minor comments

${bullets(report.minor)}${notesSection}

---

*Drafted with Margin — peer-review copilot. Reviewed and edited by a human reviewer.*
`;
}

export function downloadMarkdown(bundle: ReviewBundle, overrides?: Parameters<typeof buildMarkdown>[1]) {
  const md = buildMarkdown(bundle, overrides);
  const slug = bundle.paper.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48).replace(/-$/, "");
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `review-${slug}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Print the report screen → user saves as PDF. Forces light theme while printing. */
export function printReport() {
  const html = document.documentElement;
  const prevTheme = html.getAttribute("data-theme");
  html.setAttribute("data-theme", "light");
  document.body.setAttribute("data-printing", "report");
  const cleanup = () => {
    document.body.removeAttribute("data-printing");
    if (prevTheme) html.setAttribute("data-theme", prevTheme);
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // give the browser one frame to apply the print attributes
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}
