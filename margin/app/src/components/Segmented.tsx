import { motion } from "motion/react";

interface Option<T extends string> { value: T; label: string }

/* Apple-style segmented control with a sliding thumb (layoutId). */
export function Segmented<T extends string>({ options, value, onChange, id }: {
  options: Option<T>[]; value: T; onChange: (v: T) => void; id?: string;
}) {
  return (
    <div className="seg">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} className={on ? "on" : ""} onClick={() => onChange(o.value)}
            style={{ position:"relative" }}>
            {on && (
              <motion.span layoutId={`seg-thumb-${id ?? "default"}`}
                transition={{ type:"spring", stiffness:480, damping:38 }}
                style={{ position:"absolute", inset:0, background:"var(--surface)",
                  borderRadius:8, boxShadow:"var(--sh-sm)", zIndex:-1 }}/>
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
