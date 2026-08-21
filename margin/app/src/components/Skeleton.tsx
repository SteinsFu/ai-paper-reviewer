import type { CSSProperties } from "react";

export function Skeleton({ w, h = 14, r, style }: {
  w?: number | string; h?: number; r?: number; style?: CSSProperties;
}) {
  return <span className="skeleton" style={{ display:"block", width:w ?? "100%", height:h,
    borderRadius: r ?? 7, ...style }}/>;
}

/* A generic card-shaped loading block */
export function SkeletonCard({ height = 92 }: { height?: number }) {
  return (
    <div className="card" style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:10, height }}>
      <Skeleton w="42%" h={13}/>
      <Skeleton w="78%" h={11}/>
      <Skeleton w="62%" h={11}/>
    </div>
  );
}
