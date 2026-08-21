import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Options {
  /** move focus to the first focusable element on open (default true).
      Pass false when the surface manages its own autofocus (e.g. cmdk input). */
  autoFocus?: boolean;
}

/** Trap keyboard focus inside `ref` while `active`, and restore focus to the
    previously-focused element on close. Tab / Shift-Tab cycle within the node.
    Query is scoped to the node so it works inside portals. */
export function useFocusTrap<T extends HTMLElement>(active: boolean, opts: Options = {}) {
  const { autoFocus = true } = opts;
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    if (autoFocus) {
      const first = focusables()[0];
      first?.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey) {
        if (activeEl === first || !node.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (activeEl === last || !node.contains(activeEl)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      // restore focus to the trigger, if it's still in the document
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [active, autoFocus]);

  return ref;
}
