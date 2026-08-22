/** Coerce Bedrock-shaped list fields to string[].
 *  Tool-use sometimes returns an `<item>…</item>` blob, a bullet string, or omits the field.
 *  Report calls `.map` on these — a non-array crashes the page. */
export function asStringList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string" && item.trim()) return [item.trim()];
      if (item && typeof item === "object" && "text" in item) {
        const text = String((item as { text?: unknown }).text ?? "").trim();
        return text ? [text] : [];
      }
      return [];
    });
  }
  if (typeof value === "string") {
    const tagged = [...value.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
      .map((m) => m[1].replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (tagged.length) return tagged;
    const lines = value
      .split("\n")
      .map((line) => line.replace(/^[-*•]+\s*/, "").trim())
      .filter(Boolean);
    if (lines.length > 1) return lines;
    const text = value.trim();
    return text ? [text] : [];
  }
  if (typeof value === "object") return asStringList(Object.values(value));
  return [];
}
