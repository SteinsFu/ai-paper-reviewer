"""Benchmark the per-request cost of ``bundle_builder.build_bundle``.

Wraps the Bedrock client with a usage-capturing shim, runs the review
pipeline on a directory of PDFs, and reports:

- average page count across the sample
- per-step token / cost breakdown
- per-paper total cost (mean, std, min, max)
- headline: "average N pages, M dollars per paper"

Usage:
    python scripts/benchmark_cost.py --dir <papers_dir> [--model haiku|sonnet] [--limit N]

The tool exists to size the review cost for real workloads; it hits the
live Bedrock endpoint so it costs real money (~$0.05-0.30 per paper on
Haiku 4.5, ~$0.15-0.90 on Sonnet 4.5).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from statistics import mean, median, pstdev
from typing import Any

from dotenv import load_dotenv
from pypdf import PdfReader

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

load_dotenv(REPO_ROOT / ".env")

from bedrock_client import HAIKU_4_5, SONNET_4_5, get_client
from bundle_builder import build_bundle

# USD per 1 million tokens (public Bedrock pricing for the Claude 4.5 family).
PRICING: dict[str, dict[str, float]] = {
    HAIKU_4_5: {"input": 1.00, "output": 5.00},
    SONNET_4_5: {"input": 3.00, "output": 15.00},
}

MODEL_ALIASES = {
    "haiku": HAIKU_4_5,
    "sonnet": SONNET_4_5,
    HAIKU_4_5: HAIKU_4_5,
    SONNET_4_5: SONNET_4_5,
}


# ---------------------------------------------------------------------------
# Usage-capturing Bedrock client
# ---------------------------------------------------------------------------


@dataclass
class CallRecord:
    step: str
    input_tokens: int
    output_tokens: int


@dataclass
class PaperRecord:
    name: str
    pages: int
    words: int
    seconds: float
    calls: list[CallRecord] = field(default_factory=list)

    @property
    def input_tokens(self) -> int:
        return sum(c.input_tokens for c in self.calls)

    @property
    def output_tokens(self) -> int:
        return sum(c.output_tokens for c in self.calls)

    def cost(self, model_id: str) -> float:
        rates = PRICING[model_id]
        return (self.input_tokens / 1_000_000) * rates["input"] + (self.output_tokens / 1_000_000) * rates["output"]


class UsageCapturingClient:
    """Delegates converse() to a real client and records per-call token usage."""

    def __init__(self, real_client: Any):
        self._real = real_client
        self.calls: list[CallRecord] = []

    def converse(self, **kwargs) -> Any:
        response = self._real.converse(**kwargs)
        usage = response.get("usage", {}) or {}
        tool_config = kwargs.get("toolConfig") or {}
        tools = tool_config.get("tools") or []
        step = tools[0]["toolSpec"]["name"] if tools else "review_markdown"
        self.calls.append(CallRecord(
            step=step,
            input_tokens=int(usage.get("inputTokens", 0)),
            output_tokens=int(usage.get("outputTokens", 0)),
        ))
        return response


# ---------------------------------------------------------------------------
# PDF loading
# ---------------------------------------------------------------------------


def load_pdf(path: Path) -> tuple[bytes, int, str, int]:
    """Return (raw_bytes, page_count, extracted_text, word_count) for a PDF."""
    raw = path.read_bytes()
    reader = PdfReader(BytesIO(raw))
    pages = list(reader.pages)
    text_parts: list[str] = []
    for p in pages:
        text_parts.append(p.extract_text() or "")
    text = "\n\n".join(text_parts).strip()
    return raw, len(pages), text, len(text.split())


# ---------------------------------------------------------------------------
# Benchmark loop
# ---------------------------------------------------------------------------


def run_benchmark(papers_dir: Path, model_id: str, limit: int | None) -> list[PaperRecord]:
    pdf_paths = sorted(papers_dir.glob("*.pdf"))
    if limit is not None:
        pdf_paths = pdf_paths[:limit]
    if not pdf_paths:
        raise SystemExit(f"No PDFs found in {papers_dir}")

    print(f"Running {len(pdf_paths)} papers through {model_id}:")
    records: list[PaperRecord] = []
    for i, path in enumerate(pdf_paths, 1):
        try:
            raw, pages, text, words = load_pdf(path)
        except Exception as exc:
            print(f"  [{i:>2}/{len(pdf_paths)}] {path.name:<20}  SKIP (load failed: {exc})")
            continue

        print(f"  [{i:>2}/{len(pdf_paths)}] {path.name:<20}  pages={pages:>3}  words={words:>6}  ", end="", flush=True)
        tracker = UsageCapturingClient(get_client())
        t0 = time.time()
        try:
            build_bundle(text, pdf_bytes=raw, model=model_id, client=tracker)
        except Exception as exc:
            print(f"FAIL: {type(exc).__name__}: {str(exc)[:80]}")
            continue
        elapsed = time.time() - t0

        record = PaperRecord(name=path.name, pages=pages, words=words, seconds=elapsed, calls=list(tracker.calls))
        cost = record.cost(model_id)
        print(f"time={elapsed:>5.1f}s  cost=${cost:.4f}")
        records.append(record)

    return records


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def report(records: list[PaperRecord], model_id: str) -> dict[str, Any]:
    if not records:
        raise SystemExit("No successful runs — nothing to report.")

    n = len(records)
    pages = [r.pages for r in records]
    words = [r.words for r in records]
    costs = [r.cost(model_id) for r in records]
    input_tokens = [r.input_tokens for r in records]
    output_tokens = [r.output_tokens for r in records]
    seconds = [r.seconds for r in records]

    # Per-step aggregate
    per_step: dict[str, dict[str, float]] = {}
    for r in records:
        for c in r.calls:
            slot = per_step.setdefault(c.step, {"input": 0, "output": 0, "n": 0})
            slot["input"] += c.input_tokens
            slot["output"] += c.output_tokens
            slot["n"] += 1
    step_averages = {
        step: {
            "avg_input": s["input"] / s["n"],
            "avg_output": s["output"] / s["n"],
            "avg_cost": (
                (s["input"] / s["n"] / 1_000_000) * PRICING[model_id]["input"]
                + (s["output"] / s["n"] / 1_000_000) * PRICING[model_id]["output"]
            ),
        }
        for step, s in per_step.items()
    }

    avg_pages = mean(pages)
    avg_cost = mean(costs)

    print()
    print("=" * 72)
    print(f"BENCHMARK RESULT ({n} papers, model={model_id})")
    print("=" * 72)

    print("\nPer-paper stats:")
    print(f"  pages           mean={avg_pages:>6.1f}  min={min(pages):>3}  max={max(pages):>3}")
    print(f"  words           mean={mean(words):>6.0f}  min={min(words):>4}  max={max(words):>5}")
    print(f"  wall-clock (s)  mean={mean(seconds):>6.1f}  min={min(seconds):>5.1f}  max={max(seconds):>5.1f}")
    print(f"  input tokens    mean={mean(input_tokens):>6.0f}")
    print(f"  output tokens   mean={mean(output_tokens):>6.0f}")
    print(f"  cost per paper  mean=${avg_cost:.4f}  std=${pstdev(costs):.4f}  min=${min(costs):.4f}  max=${max(costs):.4f}  median=${median(costs):.4f}")

    print("\nPer-step averages:")
    print(f"  {'step':<32} {'input':>8} {'output':>8} {'cost':>10}")
    for step in sorted(step_averages):
        s = step_averages[step]
        print(f"  {step:<32} {s['avg_input']:>8.0f} {s['avg_output']:>8.0f} ${s['avg_cost']:>8.4f}")

    print("\nHeadline:")
    print(f"  Average {avg_pages:.1f}-page paper: ${avg_cost:.4f} per review on {model_id.split('.')[-1]}")

    return {
        "model_id": model_id,
        "n_papers": n,
        "avg_pages": avg_pages,
        "avg_cost_usd": avg_cost,
        "cost_std_usd": pstdev(costs),
        "cost_min_usd": min(costs),
        "cost_max_usd": max(costs),
        "cost_median_usd": median(costs),
        "avg_wall_clock_seconds": mean(seconds),
        "avg_input_tokens": mean(input_tokens),
        "avg_output_tokens": mean(output_tokens),
        "per_step": step_averages,
        "per_paper": [
            {"name": r.name, "pages": r.pages, "words": r.words, "seconds": r.seconds,
             "input_tokens": r.input_tokens, "output_tokens": r.output_tokens,
             "cost_usd": r.cost(model_id)}
            for r in records
        ],
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--dir", type=Path, required=True, help="Directory containing PDF files")
    parser.add_argument("--model", default="haiku", help="haiku | sonnet | full inference profile id")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of papers (default: all)")
    parser.add_argument("--out", type=Path, default=None, help="Optional path to dump JSON report")
    args = parser.parse_args()

    model_id = MODEL_ALIASES.get(args.model)
    if model_id is None:
        raise SystemExit(f"Unknown model {args.model!r}; choose from {list(MODEL_ALIASES)}")

    records = run_benchmark(args.dir, model_id, args.limit)
    result = report(records, model_id)
    if args.out:
        args.out.write_text(json.dumps(result, indent=2))
        print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
