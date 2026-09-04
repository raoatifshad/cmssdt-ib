// Shared "mission control" palette for the Shift Console. Deliberately dark - it echoes
// this app's own navbar (see Navigation.js NAV_THEME: navbarBg rgba(15,23,42,0.92),
// dropdownBg #0b1220) rather than inventing an unrelated look, so a shifter reads it as
// "the live ops surface of this app" instead of a bolted-on separate product.
export const theme = {
  page: "#0a0f1c",
  surface: "#121a2b",
  surfaceRaised: "#17203570",
  border: "rgba(148, 163, 184, 0.16)",
  borderStrong: "rgba(148, 163, 184, 0.3)",
  text: "#f1f5f9",
  textSecondary: "#cbd5e1",
  textMuted: "#8291ab",
  primary: "#3b82f6",
  primaryStrong: "#2563eb",
  mono: "'SFMono-Regular', Consolas, monospace",
};

// Same radial-gradient sphere treatment as GuideSphere in Navigation.js, reused here so
// the failing/resolved/warning badges on this page read as the same "status language"
// a shifter already knows from the main IB dashboard's pass/fail spheres.
export const TONE = {
  success: {
    fg: "#4ade80",
    tint: "rgba(34, 197, 94, 0.14)",
    ring: "rgba(34, 197, 94, 0.35)",
    grad: "radial-gradient(circle at 30% 25%, #79C779 0%, #5EB85E 50%, #3E9A3E 90%)",
    glow: "rgba(16, 185, 129, 0.35)",
  },
  danger: {
    fg: "#f87171",
    tint: "rgba(239, 68, 68, 0.14)",
    ring: "rgba(239, 68, 68, 0.4)",
    grad: "radial-gradient(circle at 30% 25%, #f87171 0%, #ef4444 50%, #dc2626 90%)",
    glow: "rgba(239, 68, 68, 0.4)",
  },
  warning: {
    fg: "#fbbf24",
    tint: "rgba(245, 158, 11, 0.14)",
    ring: "rgba(245, 158, 11, 0.4)",
    grad: "radial-gradient(circle at 30% 25%, #fbbf24 0%, #f59e0b 50%, #d97706 90%)",
    glow: "rgba(245, 158, 11, 0.35)",
  },
  neutral: {
    fg: "#8291ab",
    tint: "rgba(148, 163, 184, 0.08)",
    ring: "rgba(148, 163, 184, 0.22)",
    grad: "rgba(148, 163, 184, 0.12)",
    glow: "transparent",
  },
};

export const CARD = {
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  borderRadius: 14,
  padding: "20px 22px",
};
