import React from "react";
import { theme } from "./theme";

// Unit-test detail the backend adds to "Newly failing Unit Tests" rows (digest markdown) and
// to the release-explorer `unittests` JSON rows: which tests inside the package failed. The
// cell is either test names ("<br>"-joined, maybe ending in "+N more") or exactly one of
// these fixed strings - a statement about the logs, never a test name, so it renders muted.
export const FAILED_TESTS_NO_LOGS = "no logs imported for this build yet";
export const FAILED_TESTS_NOT_FOUND = "not found in the imported log";
const FIXED_NOTES = [FAILED_TESTS_NO_LOGS, FAILED_TESTS_NOT_FOUND];

export function parseFailedTests(value) {
  const text = (value || "").replace(/\\\|/g, "|").trim();
  if (!text) return { names: [], more: "", note: "" };
  if (FIXED_NOTES.includes(text.toLowerCase())) return { names: [], more: "", note: text };
  const parts = text.split(/<br\s*\/?>/i).map((p) => p.trim()).filter(Boolean);
  const more = /^\+\d+ more$/i.test(parts[parts.length - 1] || "") ? parts.pop() : "";
  return { names: parts, more, note: "" };
}

// The release-explorer JSON row -> the same cell string the digest uses, so both views go
// through parseFailedTests/FailedTestsList. `undefined` when the backend didn't send the
// field at all (older backend, or no `archs` passed) - the column is then left out.
export function failedTestsCellOf(item) {
  if (!item || item.logs_imported === undefined) return undefined;
  if (!item.logs_imported) return FAILED_TESTS_NO_LOGS;
  const names = item.failed_tests || [];
  return names.length ? names.join("<br>") : FAILED_TESTS_NOT_FOUND;
}

// "<errors> failed / <total>" - same wording as the digest's Tests column.
export function testsCellOf(item) {
  if (!item || item.total == null) return "";
  return `${item.errors ?? 0} failed / ${item.total}`;
}

// One test name per line (monospace - they're identifiers to grep for), or the fixed note
// as muted italic text.
export const FailedTestsList = ({ value, light = false }) => {
  const { names, more, note } = parseFailedTests(value);
  const muted = light ? "#64748b" : theme.textMuted;
  if (note) return <span style={{ color: muted, fontStyle: "italic" }}>{note}</span>;
  if (!names.length) return null;
  return (
    <div style={{ fontFamily: theme.mono, fontSize: "0.76rem", lineHeight: 1.5 }}>
      {names.map((name, idx) => (
        <div key={idx} style={{ overflowWrap: "anywhere" }}>
          {name}
        </div>
      ))}
      {more && <div style={{ color: muted, fontFamily: "inherit", fontStyle: "italic" }}>{more}</div>}
    </div>
  );
};
