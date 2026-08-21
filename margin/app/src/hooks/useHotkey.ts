import { useEffect } from "react";

interface HotkeyOpts {
  meta?: boolean;   // ⌘ on macOS, Ctrl elsewhere
  shift?: boolean;
}

/** Register a global hotkey. `key` is compared against e.key, lowercase. */
export function useHotkey(key: string, handler: () => void, opts: HotkeyOpts = {}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (opts.meta && !(e.metaKey || e.ctrlKey)) return;
      if (opts.shift && !e.shiftKey) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      // don't hijack plain keys while typing (Escape is always allowed)
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (typing && !opts.meta && key.toLowerCase() !== "escape") return;
      e.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, handler, opts.meta, opts.shift]);
}
