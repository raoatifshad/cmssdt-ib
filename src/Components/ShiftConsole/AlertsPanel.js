import React from "react";
import { BsCheckCircle } from "react-icons/bs";
import { renderInline } from "./shiftMarkdown";
import { theme, TONE } from "./theme";
import PanelState from "./PanelState";

const AlertCard = ({ alert }) => (
  <div
    style={{
      background: TONE.danger.tint,
      border: `1px solid ${TONE.danger.ring}`,
      borderLeft: "4px solid #ef4444",
      borderRadius: 10,
      padding: "12px 16px",
      marginBottom: 10,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
      <span
        style={{
          fontWeight: 700,
          fontSize: "0.78rem",
          color: TONE.danger.fg,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {alert.rule?.name || "Alert"}
      </span>
      {typeof alert.evidence?.count === "number" && (
        <span style={{ fontFamily: theme.mono, fontWeight: 700, color: TONE.danger.fg, fontSize: "0.85rem" }}>
          {alert.evidence.count}
        </span>
      )}
    </div>
    <div style={{ color: theme.textSecondary, fontSize: "0.9rem" }}>{renderInline(alert.message)}</div>
    {alert.details?.length > 0 && (
      <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
        {alert.details.map((line, idx) => (
          <li key={idx} style={{ color: theme.textSecondary, fontSize: "0.84rem", marginBottom: 2 }}>
            {renderInline(line)}
          </li>
        ))}
        {alert.moreCount > 0 && (
          <li style={{ color: theme.textMuted, fontSize: "0.82rem", fontStyle: "italic", listStyle: "none", marginLeft: -18 }}>
            +{alert.moreCount} more — see the Shift digest below
          </li>
        )}
      </ul>
    )}
  </div>
);

const AlertsPanel = ({ alerts, loading, error, onRetry }) => {
  if (loading) return <PanelState kind="loading" text="Checking alerts…" />;
  if (error) return <PanelState kind="error" text="Couldn't load alert status." onRetry={onRetry} />;

  if (!alerts || alerts.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: TONE.success.fg,
          background: TONE.success.tint,
          border: `1px solid ${TONE.success.ring}`,
          borderRadius: 10,
          padding: "14px 16px",
          fontSize: "0.9rem",
          fontWeight: 500,
        }}
      >
        <BsCheckCircle size={16} />
        No alerts currently firing
      </div>
    );
  }

  return (
    <div>
      {alerts.map((alert, idx) => (
        <AlertCard key={alert.rule?.rule_id || idx} alert={alert} />
      ))}
    </div>
  );
};

export default AlertsPanel;
