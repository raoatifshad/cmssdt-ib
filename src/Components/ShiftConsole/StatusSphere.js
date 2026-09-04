import React from "react";
import { theme, TONE } from "./theme";

const STATUS_TONE = {
  success: "success",
  danger: "danger",
  warning: "warning",
  secondary: "neutral",
  missing: "neutral",
};

// Shared sphere badge used by both the architecture severity matrix (ArchMatrix.js) and
// the Release Explorer's per-category grid (ReleaseStatusGrid.js), so both surfaces read
// as one status language instead of two slightly different badge styles.
const StatusSphere = ({ status, value, icon, size = 34 }) => {
  const tone = TONE[STATUS_TONE[status] || "neutral"];
  const active = status !== "secondary" && status !== "missing";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: size,
        height: size,
        borderRadius: "50%",
        background: active ? tone.grad : "rgba(148, 163, 184, 0.07)",
        color: active ? "#08111f" : theme.textMuted,
        fontWeight: 800,
        fontSize: "0.74rem",
        border: active ? "1px solid rgba(255,255,255,0.22)" : `1px dashed ${theme.border}`,
        textShadow: active ? "0 1px 1px rgba(255,255,255,0.35)" : "none",
        boxShadow: active ? `0 3px 12px -3px ${tone.glow}` : "none",
        flexShrink: 0,
      }}
    >
      {value !== null && value !== undefined ? value : icon || "–"}
    </span>
  );
};

export default StatusSphere;
