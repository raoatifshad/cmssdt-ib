import React from "react";
import { Spinner } from "react-bootstrap";
import { theme, TONE } from "./theme";

const PanelState = ({ kind, text, onRetry }) => {
  if (kind === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: theme.textMuted, padding: "18px 4px" }}>
        <Spinner animation="border" size="sm" />
        <span style={{ fontSize: "0.9rem" }}>{text}</span>
      </div>
    );
  }

  if (kind === "error") {
    return (
      <div
        style={{
          color: TONE.danger.fg,
          background: TONE.danger.tint,
          border: `1px solid ${TONE.danger.ring}`,
          borderRadius: 10,
          padding: "14px 16px",
          fontSize: "0.88rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span>{text}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              border: `1px solid ${TONE.danger.ring}`,
              background: "transparent",
              color: TONE.danger.fg,
              borderRadius: 999,
              padding: "4px 12px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ color: theme.textMuted, fontSize: "0.88rem", fontStyle: "italic", padding: "14px 4px" }}>{text}</div>
  );
};

export default PanelState;
