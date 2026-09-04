import React from "react";
import { renderInline } from "./shiftMarkdown";
import { theme } from "./theme";
import StatusSphere from "./StatusSphere";

// Architecture x category severity grid - the single surface a shifter should need to
// scan to know where to look. Modeled on the status-matrix pattern common to ops
// dashboards (PagerDuty service ladders, Datadog monitor grids): one glance finds the
// hot cell instead of clicking through a tab per architecture.
const CATEGORIES = [
  { key: "newFailing", label: "Failing", tone: "danger" },
  { key: "resolved", label: "Resolved", tone: "success" },
  { key: "newWarnings", label: "Warnings", tone: "warning" },
];

const Badge = ({ value, tone }) => (
  <StatusSphere status={value > 0 ? tone : "secondary"} value={value} />
);

const ArchMatrix = ({ archs, statsByArch, activeIdx, onSelect }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr repeat(3, 72px)",
        alignItems: "center",
        gap: 12,
        padding: "0 14px",
      }}
    >
      <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: theme.textMuted }}>
        Architecture
      </span>
      {CATEGORIES.map((c) => (
        <span
          key={c.key}
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: theme.textMuted,
            textAlign: "center",
          }}
        >
          {c.label}
        </span>
      ))}
    </div>

    {archs.map((archItem, idx) => {
      const stats = statsByArch[idx];
      const active = idx === activeIdx;
      return (
        <button
          key={archItem.name}
          type="button"
          onClick={() => onSelect(idx)}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr repeat(3, 72px)",
            alignItems: "center",
            gap: 12,
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${active ? theme.primary : theme.border}`,
            background: active ? "rgba(59, 130, 246, 0.14)" : theme.surface,
            cursor: "pointer",
            transition: "border-color 0.15s ease, background 0.15s ease",
            textAlign: "left",
          }}
        >
          <span style={{ fontFamily: theme.mono, fontWeight: 700, fontSize: "0.84rem", color: theme.text }}>
            {renderInline(archItem.name)}
          </span>
          {CATEGORIES.map((c) => (
            <span key={c.key} style={{ display: "flex", justifyContent: "center" }}>
              <Badge value={stats[c.key]} tone={c.tone} />
            </span>
          ))}
        </button>
      );
    })}
  </div>
);

export default ArchMatrix;
