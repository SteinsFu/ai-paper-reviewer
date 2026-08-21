import { Icon } from "./Icon";
import type { ThemePref } from "../hooks/useTheme";

const OPTIONS: { value: ThemePref; label: string; ic: "sun" | "moon" | "sliders" }[] = [
  { value: "light",  label: "Light",  ic: "sun" },
  { value: "dark",   label: "Dark",   ic: "moon" },
  { value: "system", label: "Auto",   ic: "sliders" },
];

export function ThemeToggle({ pref, onChange }: { pref: ThemePref; onChange: (p: ThemePref) => void }) {
  return (
    <div className="seg" style={{ width:"100%", display:"flex" }}>
      {OPTIONS.map((o) => (
        <button key={o.value} className={pref === o.value ? "on" : ""}
          onClick={() => onChange(o.value)} title={o.label}
          style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            padding:"6px 0", background: pref === o.value ? "var(--surface)" : "transparent",
            boxShadow: pref === o.value ? "var(--sh-sm)" : "none" }}>
          <Icon name={o.ic} size={13}/>
          <span style={{ fontSize:11.5 }}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
