import React from "react";
import { BsBell, BsCheckCircle, BsCpu, BsExclamationTriangle } from "react-icons/bs";
import { theme, TONE } from "./theme";

// Grafana-style stat tile: big number, a left edge bar in the threshold color so the
// state reads peripherally without focusing on the number, and an icon chip that
// reuses the same tone as the edge bar.
const Tile = ({ icon, value, label, tone }) => {
  const t = TONE[tone];
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 14,
        padding: "16px 18px 16px 22px",
        flex: "1 1 170px",
        overflow: "hidden",
      }}
    >
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: t.fg, opacity: tone === "neutral" ? 0.35 : 0.9 }} />
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: t.tint,
          color: t.fg,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "1.55rem", fontWeight: 800, color: theme.text, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "0.76rem", color: theme.textMuted, marginTop: 4, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
};

const ShiftScoreboard = ({ archCount, stats, alertsCount, alertsLoading }) => (
  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
    <Tile icon={<BsCpu size={18} />} value={archCount} label="Architectures checked" tone="neutral" />
    <Tile
      icon={<BsExclamationTriangle size={17} />}
      value={stats.newFailing}
      label="Newly failing workflows"
      tone={stats.newFailing ? "danger" : "success"}
    />
    <Tile icon={<BsCheckCircle size={17} />} value={stats.resolved} label="Resolved workflows" tone="success" />
    <Tile
      icon={<BsExclamationTriangle size={17} />}
      value={stats.newWarnings}
      label="New Clang warnings"
      tone={stats.newWarnings ? "warning" : "success"}
    />
    <Tile
      icon={<BsBell size={16} />}
      value={alertsLoading ? "…" : alertsCount}
      label="Alerts firing"
      tone={alertsCount ? "danger" : "success"}
    />
  </div>
);

export default ShiftScoreboard;
