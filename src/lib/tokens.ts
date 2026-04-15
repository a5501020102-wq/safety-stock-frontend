/**
 * Design tokens mirrored for JS/TS access.
 *
 * Source of truth is `src/app/globals.css` (`@theme`). This file exposes a
 * handful of constants that are sometimes easier to reference from TS than
 * from CSS — e.g. Plotly chart colors, computed inline styles, etc.
 *
 * Keep this file minimal. Prefer Tailwind utility classes or CSS variables
 * wherever possible.
 */

export const colors = {
  background: "#F9F8F6",
  foreground: "#1A1A1A",
  muted: "#EBE5DE",
  mutedForeground: "#6C6863",
  accent: "#D4AF37",
  accentForeground: "#FFFFFF",
  border: "rgba(26, 26, 26, 0.15)",

  // Status
  shortage: "#8B2635",
  healthy: "#3A5A40",
  overstock: "#8B7355",

  // ABC grading
  abcA: "#1A1A1A",
  abcB: "#6C6863",
  abcC: "#A89888",
} as const;

export const motion = {
  ease: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  durationFast: 300,
  durationBase: 500,
  durationSlow: 700,
  durationSlower: 1500,
} as const;

export const typography = {
  trackingLabel: "0.3em",
  trackingLuxury: "0.25em",
  trackingButton: "0.2em",
} as const;
