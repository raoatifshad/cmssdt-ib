import React from "react";
import { theme, TONE } from "./theme";

// Column names (lower-cased) the backend may use for a failure's captured exception / first
// error text - in the shift-summary markdown tables and in WorkflowTable rows built from the
// release-explorer JSON. One list so the digest, Recent Problems and the explorer tables all
// recognize the same headers.
export const EXCEPTION_COLUMNS = ["exception", "error message"];

// The release-explorer JSON's per-row field for the same text.
export function exceptionOf(item) {
  return (item && (item.exception || item.error_message)) || "";
}

// A markdown table cell can't hold a real newline, so the backend's multi-line exception
// text arrives with <br> line breaks and escaped pipes, sometimes wrapped in backticks -
// undo all of that so the block below shows the message exactly as cmsRun printed it.
export function normalizeExceptionText(value) {
  let text = (value || "").trim();
  if (/^`[^`]*`$/.test(text)) text = text.slice(1, -1);
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\\\|/g, "|")
    .trim();
}

// First non-blank line, for a one-line preview next to a collapsed item.
export function exceptionHeadline(value) {
  return normalizeExceptionText(value).split("\n").find((line) => line.trim()) || "";
}

// The exact exception text in a scrollable monospace block - preserved whitespace, since
// cmsRun's "----- Begin Fatal Exception" output is indented and line-structured, and a
// height cap so one long stack trace can't push the rest of the list off screen.
// `raw`: the text is already plain log output (not a markdown table cell) - show it as is.
export const ExceptionBlock = ({ text, light = false, raw = false }) => {
  const body = raw ? String(text || "").replace(/\s+$/, "") : normalizeExceptionText(text);
  if (!body) return null;
  return (
    <pre
      style={{
        margin: "4px 0 2px",
        padding: "8px 10px",
        maxHeight: 220,
        overflow: "auto",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        fontFamily: theme.mono,
        fontSize: "0.74rem",
        lineHeight: 1.45,
        color: light ? "#7f1d1d" : "#fecaca",
        background: light ? "rgba(220, 38, 38, 0.05)" : "rgba(239, 68, 68, 0.08)",
        border: `1px solid ${light ? "rgba(220, 38, 38, 0.25)" : TONE.danger.ring}`,
        borderLeft: `3px solid ${light ? "#dc2626" : TONE.danger.fg}`,
        borderRadius: 6,
      }}
    >
      {body}
    </pre>
  );
};
