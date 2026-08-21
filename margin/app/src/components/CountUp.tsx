import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/* Animated number — counts from 0 to value on mount. */
export function CountUp({ value, duration = 0.9 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) { el.textContent = String(value); return; }
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 0.61, 0.36, 1],
      onUpdate: (v) => { el.textContent = String(Math.round(v)); },
    });
    return () => controls.stop();
  }, [value, duration, reduced]);
  return <span ref={ref} className="num">{value}</span>;
}
