import { motion } from "motion/react";
import { Icon } from "./Icon";

/** A friendly, retryable failure panel — shown when a fetch rejects.
    Tokens only, so it themes correctly in light and dark. */
export function ErrorState({ title, message, onRetry, compact }: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        gap: 14, padding: compact ? "40px 24px" : "72px 24px", margin: "0 auto", maxWidth: 420,
      }}>
      <div style={{
        width: 54, height: 54, borderRadius: 15, display: "grid", placeItems: "center",
        background: "var(--critical-soft)", color: "var(--critical)",
      }}>
        <Icon name="alert" size={26} />
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 5 }}>
          {title ?? "Something went wrong"}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.5 }}>
          {message ?? "We couldn't load this just now. Please try again."}
        </div>
      </div>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry} style={{ marginTop: 4 }}>
          <Icon name="restore" size={16} /> Try again
        </button>
      )}
    </motion.div>
  );
}
