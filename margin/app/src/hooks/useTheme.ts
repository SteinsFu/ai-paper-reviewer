import { useCallback, useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";
const STORAGE_KEY = "margin-theme";

function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && systemDark());
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  });

  useEffect(() => {
    apply(pref);
    localStorage.setItem(STORAGE_KEY, pref);
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const resolved: "light" | "dark" =
    pref === "system" ? (systemDark() ? "dark" : "light") : pref;

  const toggle = useCallback(() => {
    setPref((p) => {
      const isDark = p === "dark" || (p === "system" && systemDark());
      return isDark ? "light" : "dark";
    });
  }, []);

  return { pref, setPref, resolved, toggle };
}
