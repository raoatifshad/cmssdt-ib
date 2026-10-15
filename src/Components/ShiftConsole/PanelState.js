import React, { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import { theme, TONE } from "./theme";

// Some shift-summary windows legitimately take ~2 minutes on the backend - after this long a
// loading state adds `slowText`, so a shifter knows it's still working, not stuck.
const SLOW_AFTER_MS = 15000;

const LoadingState = ({ text, slowText }) => {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!slowText) return undefined;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [slowText]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: theme.textMuted, padding: "18px 4px" }}>
      <Spinner animation="border" size="sm" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: "0.9rem" }}>
        {text}
        {slow && <span style={{ display: "block", fontSize: "0.8rem", marginTop: 2 }}>{slowText}</span>}
      </span>
    </div>
  );
};

// Shared wording for the shift-summary request (Recent Problems + Shift digest both wait on it).
export const SUMMARY_SLOW_TEXT = "Still loading - some windows take up to two minutes while the backend gathers PR/Issue evidence.";
export const SUMMARY_TIMEOUT_TEXT = "This window took too long to load (the backend is slow for some windows). Try again, or pick another window.";

const PanelState = ({ kind, text, onRetry, slowText }) => {
  if (kind === "loading") return <LoadingState text={text} slowText={slowText} />;

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
