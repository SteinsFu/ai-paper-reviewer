/* SF-symbol-ish stroke icon set. Add new paths here — 24×24 viewBox, stroke 1.7. */
import type { CSSProperties } from "react";

export const ICONS = {
  home:      "M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5",
  doc:       "M6 2.5h8l4 4V21a.5.5 0 0 1-.5.5H6A1.5 1.5 0 0 1 4.5 20V4A1.5 1.5 0 0 1 6 2.5ZM14 2.5V7h4",
  spark:     "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
  eye:       "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z",
  compass:   "M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19ZM15.5 8.5l-2 5-5 2 2-5 5-2Z",
  report:    "M5 3.5h11l3 3V20.5H5zM8.5 11.5h7M8.5 15h5M8.5 8h4",
  upload:    "M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 16v3.5h14V16",
  check:     "M4 12.5l5 5 11-11",
  checkCircle:"M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19ZM8 12l2.8 2.8L16 9.5",
  alert:     "M12 8v5m0 3h.01M10.3 3.9 2.4 18a1.8 1.8 0 0 0 1.6 2.7h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z",
  info:      "M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19ZM12 11v5m0-8h.01",
  search:    "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l5 5",
  chevR:     "M9 5l7 7-7 7",
  chevL:     "M15 5l-7 7 7 7",
  chevD:     "M5 9l7 7 7-7",
  close:     "M5 5l14 14M19 5 5 19",
  book:      "M12 6.5C10.5 5 8 4.5 4.5 4.5V19c3.5 0 6 .5 7.5 2 1.5-1.5 4-2 7.5-2V4.5C16 4.5 13.5 5 12 6.5ZM12 6.5V21",
  quote:     "M9.5 6C6.5 7 5 9.5 5 13v5h5v-5H7.5c0-2 .8-3.4 2.8-4L9.5 6ZM18.5 6c-3 1-4.5 3.5-4.5 7v5h5v-5h-2.5c0-2 .8-3.4 2.8-4L18.5 6Z",
  pen:       "M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z M14.5 6.5l3 3",
  layers:    "M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 16.5l9 5 9-5",
  clock:     "M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19ZM12 7v5l3.5 2",
  grid:      "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  menu:      "M4 7h16M4 12h16M4 17h16",
  target:    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 13.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z",
  external:  "M14 5h5v5M19 5l-8 8M18 13.5V19a.5.5 0 0 1-.5.5H6A1.5 1.5 0 0 1 4.5 18V6.5A.5.5 0 0 1 5 6h5.5",
  link:      "M9.5 14.5l5-5M8 12l-2 2a3.5 3.5 0 0 0 5 5l2-2M16 12l2-2a3.5 3.5 0 0 0-5-5l-2 2",
  sliders:   "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6",
  arrowR:    "M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5",
  plus:      "M12 5v14M5 12h14",
  download:  "M12 4v11m0 0 4-4m-4 4-4-4M5 19h14",
  filter:    "M3 5h18l-7 8v6l-4-2v-4L3 5Z",
  bolt:      "M13 3 5 13h6l-1 8 8-10h-6l1-8Z",
  star:      "M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 17.1 6.7 20l1.2-6L3.4 9.8l6-.7L12 3.5Z",
  sun:       "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6",
  moon:      "M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z",
  chat:      "M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.5-5.6A8.5 8.5 0 1 1 21 12Z",
  command:   "M9 9V6a3 3 0 1 0-3 3h3Zm0 0v6m0-6h6m-6 6v3a3 3 0 1 1-3-3h3Zm6-6h3a3 3 0 1 0-3-3v3Zm0 0v6m0 0h3a3 3 0 1 1-3 3v-3Z",
  send:      "M21 3 10.5 13.5M21 3l-7 18-3.5-7.5L3 10l18-7Z",
  archive:   "M3.5 4.5h17v4h-17zM5 8.5h14V19a.5.5 0 0 1-.5.5H5.5A.5.5 0 0 1 5 19zM9.5 12.5h5",
  trash:     "M4 6.5h16M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5M6 6.5l.9 13a1.5 1.5 0 0 0 1.5 1.4h7.2a1.5 1.5 0 0 0 1.5-1.4l.9-13M10 10.5v6M14 10.5v6",
  restore:   "M8 6 3.5 10.5 8 15M3.5 10.5h11a6 6 0 1 1 0 12H9",
  gradCap:   "M2 8.5 12 4l10 4.5-10 4.5-10-4.5ZM6 10.7V15c0 1.1 2.7 2.2 6 2.2s6-1.1 6-2.2v-4.3M20 9.4v4.6",
  user:      "M12 12.5a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4ZM4.5 20a7.5 7.5 0 0 1 15 0",
  logout:    "M15 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h9M14 12H10.5M14 12l-3-3M14 12l-3 3M14 12h6",
  eyeOff:    "M9.9 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.4M6.3 7.8A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.3-1M10 10a2.8 2.8 0 0 0 3.9 4M3 3l18 18",
  bell:      "M12 3.5a6 6 0 0 0-6 6c0 4.5-1.8 5.8-1.8 5.8h15.6S18 14 18 9.5a6 6 0 0 0-6-6ZM9.7 19.5a2.5 2.5 0 0 0 4.6 0",
  gear:      "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM19.4 12a7.5 7.5 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.4 7.4 0 0 0-2-1.2l-.3-2.5H8.3L8 5.7a7.4 7.4 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.4 7.4 0 0 0 2 1.2l.3 2.5h4.1l.3-2.5a7.4 7.4 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z",
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  fill?: boolean;
  style?: CSSProperties;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 18, fill = false, style, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}
      style={style} fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}
