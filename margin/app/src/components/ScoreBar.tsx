import { useEffect, useState } from "react";

export function ScoreBar({ value, color }: { value: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), 60);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div style={{ height:7, borderRadius:99, background:"var(--track)", overflow:"hidden", flex:1 }}>
      <div style={{ height:"100%", width:`${w}%`, borderRadius:99, background:color,
        transition:"width 1s cubic-bezier(.22,.61,.36,1)" }}/>
    </div>
  );
}
