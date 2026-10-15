import React, { useState } from "react";
import { Collapse } from "react-bootstrap";
import { BsChevronRight, BsInfoCircle } from "react-icons/bs";
import { theme, TONE } from "./theme";
import PanelState from "./PanelState";
import { ExceptionBlock } from "./exceptionText";
import {
  SUITE_LABEL,
  baselineNoteFor,
  baselineNotesByTrack,
  kindChipText,
  logLocation,
  summarizeBaselineNotes,
  variantLabel,
} from "./logProblems";

// Drill-down for the "Hidden problems in passed tests" tile (GET /api/test-log-problems):
// per architecture, the New list, then Intermittent (returned), then a collapsed Gone list
// and the still-present count. New and returned are always two separate lists - "first time
// for this test" and "came back after a clean build" are different findings.

const chip = (color, bg, border) => ({
  display: "inline-block",
  fontSize: "0.7rem",
  fontWeight: 700,
  padding: "1px 8px",
  borderRadius: 999,
  color,
  background: bg,
  border: `1px solid ${border}`,
  whiteSpace: "nowrap",
});

const KIND_CHIP = chip("#f9a8d4", "rgba(244, 114, 182, 0.12)", "rgba(244, 114, 182, 0.35)");
const META_CHIP = chip(theme.textSecondary, "rgba(148, 163, 184, 0.1)", theme.border);

const mutedNote = {
  display: "flex",
  alignItems: "flex-start",
  gap: 6,
  color: theme.textMuted,
  fontSize: "0.76rem",
  fontStyle: "italic",
  overflowWrap: "anywhere",
};

const listHeading = (color) => ({
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color,
  margin: "12px 0 6px",
});

const Disclosure = ({ open }) => (
  <BsChevronRight
    size={10}
    color={theme.textMuted}
    style={{ flexShrink: 0, marginTop: 5, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.1s" }}
  />
);

// One test/workflow step that hit the problem. Variant + run_variant are always shown -
// the same test name can appear once per sub-IB or GPU run, and without them those rows
// read as contradictory duplicates.
const TestRow = ({ test, notes, showFirstSeen }) => {
  const note = baselineNoteFor(notes, test);
  return (
    <li style={{ listStyle: "none", padding: "5px 0", borderTop: `1px solid ${theme.border}` }}>
      <div style={{ fontFamily: theme.mono, fontSize: "0.78rem", color: theme.text, overflowWrap: "anywhere" }}>{test.name}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 3, alignItems: "center" }}>
        <span style={META_CHIP}>{SUITE_LABEL[test.suite] || test.suite}</span>
        <span style={{ ...META_CHIP, fontFamily: theme.mono }}>{variantLabel(test)}</span>
        {test.baseline_tag && (
          <span style={{ fontSize: "0.72rem", color: theme.textMuted, overflowWrap: "anywhere" }}>
            baseline <span style={{ fontFamily: theme.mono }}>{test.baseline_tag}</span>
          </span>
        )}
      </div>
      {showFirstSeen && test.first_seen_tag && (
        <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2, overflowWrap: "anywhere" }}>
          first seen in this test: <span style={{ fontFamily: theme.mono }}>{test.first_seen_tag}</span>
        </div>
      )}
      {note && <div style={{ ...mutedNote, marginTop: 2 }}>{note}</div>}
    </li>
  );
};

// One problem (signature): kind chip, summary, "problem known since", test count; expands
// to its tests, the log evidence and where to find the log.
const ProblemGroup = ({ group, notes, kind }) => {
  const [open, setOpen] = useState(false);
  const where = logLocation(group.log);
  const testCount = group.tests?.length || 0;
  return (
    <li style={{ listStyle: "none", borderBottom: `1px solid ${theme.border}`, padding: "6px 0" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{ all: "unset", boxSizing: "border-box", display: "flex", gap: 8, width: "100%", cursor: "pointer" }}
      >
        <Disclosure open={open} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={KIND_CHIP}>{kindChipText(group)}</span>
            <span style={{ color: theme.text, fontSize: "0.85rem", overflowWrap: "anywhere" }}>{group.summary}</span>
          </span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 3, fontSize: "0.74rem", color: theme.textMuted }}>
            <span>
              {testCount} test{testCount === 1 ? "" : "s"}
            </span>
            {group.first_seen_tag && (
              <span style={{ overflowWrap: "anywhere" }}>
                problem known since <span style={{ fontFamily: theme.mono }}>{group.first_seen_tag}</span>
              </span>
            )}
          </span>
          {group.intentional_hint && (
            <span style={{ ...mutedNote, marginTop: 3 }}>
              <BsInfoCircle size={11} style={{ flexShrink: 0, marginTop: 2 }} />
              The log says: {group.intentional_hint}
            </span>
          )}
        </span>
      </button>
      <Collapse in={open}>
        <div>
          <div style={{ padding: "6px 0 4px 18px" }}>
            <ul style={{ margin: 0, padding: 0 }}>
              {(group.tests || []).map((test, idx) => (
                <TestRow key={idx} test={test} notes={notes} showFirstSeen={kind === "returned"} />
              ))}
            </ul>
            {group.evidence && (
              <>
                <div style={{ ...listHeading(theme.textMuted), margin: "8px 0 2px" }}>Evidence</div>
                <ExceptionBlock text={group.evidence} raw />
              </>
            )}
            {where && (
              <div style={{ fontSize: "0.74rem", color: theme.textMuted, marginTop: 4 }}>
                Where to look (cmssdt9-02):{" "}
                <span style={{ fontFamily: theme.mono, color: theme.textSecondary, overflowWrap: "anywhere", userSelect: "all" }}>{where}</span>
              </div>
            )}
          </div>
        </div>
      </Collapse>
    </li>
  );
};

const ProblemList = ({ title, color, groups, notes, kind, empty }) => (
  <div>
    <div style={listHeading(color)}>
      {title} ({groups.length})
    </div>
    {groups.length === 0 ? (
      <div style={{ color: theme.textMuted, fontSize: "0.8rem" }}>{empty}</div>
    ) : (
      <ul style={{ margin: 0, padding: 0 }}>
        {groups.map((group, idx) => (
          <ProblemGroup key={`${group.signature_id}-${idx}`} group={group} notes={notes} kind={kind} />
        ))}
      </ul>
    )}
  </div>
);

// Gone: collapsed by default - the test ran again without the problem.
const GoneList = ({ groups, notes }) => {
  const [open, setOpen] = useState(false);
  if (!groups.length) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{ all: "unset", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", ...listHeading(TONE.success.fg) }}
      >
        <Disclosure open={open} />
        Gone ({groups.length})
      </button>
      <Collapse in={open}>
        <div>
          <ul style={{ margin: 0, padding: 0 }}>
            {groups.map((group, idx) => (
              <ProblemGroup key={`${group.signature_id}-${idx}`} group={group} notes={notes} kind="gone" />
            ))}
          </ul>
        </div>
      </Collapse>
    </div>
  );
};

const ArchSection = ({ arch, first }) => {
  const notes = baselineNotesByTrack(arch);
  const baselineSummary = summarizeBaselineNotes(arch);
  const noBaseline = arch.no_baseline || [];
  return (
    <div style={{ padding: "12px 14px", borderTop: first ? "none" : `1px solid ${theme.border}` }}>
      <div style={{ fontFamily: theme.mono, fontSize: "0.78rem", color: theme.textSecondary, fontWeight: 700 }}>{arch.arch}</div>
      {baselineSummary.map(({ note, variants }) => (
        <div key={note} style={{ ...mutedNote, marginTop: 3 }}>
          <BsInfoCircle size={11} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <span style={{ fontFamily: theme.mono, fontStyle: "normal" }}>{variants.join(", ")}</span>: {note}
          </span>
        </div>
      ))}
      {noBaseline.length > 0 && (
        <div style={{ ...mutedNote, marginTop: 3 }}>
          <BsInfoCircle size={11} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Not compared (no baseline):{" "}
            {noBaseline.map((t) => `${variantLabel(t)} ${SUITE_LABEL[t.suite] || t.suite}`).join(", ")}
          </span>
        </div>
      )}
      <ProblemList title="New" color={TONE.danger.fg} groups={arch.new || []} notes={notes} kind="new" empty="No new problems." />
      <ProblemList
        title="Intermittent (returned)"
        color={TONE.warning.fg}
        groups={arch.returned || []}
        notes={notes}
        kind="returned"
        empty="Nothing came back."
      />
      <GoneList groups={arch.gone || []} notes={notes} />
      <div style={{ ...listHeading(theme.textMuted), textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>
        Still present: {arch.still_present ?? 0}
      </div>
    </div>
  );
};

const HiddenProblemsPanel = ({ state, onRetry, jumpTarget, onJump }) => {
  const { data, loading, error } = state;
  let body;
  if (loading && !data) body = <PanelState kind="loading" text="Reading test-log problems…" />;
  else if (error) body = <PanelState kind="error" text="Couldn't load test-log problems." onRetry={onRetry} />;
  else if (!data) body = <PanelState kind="empty" text="Waiting for the shift window…" />;
  else if (!data.coverage?.to_imported) {
    body = (
      <div style={{ padding: "14px 16px", color: theme.textSecondary, fontSize: "0.86rem" }}>
        {data.coverage?.message || `No test logs imported yet for ${data.to}. This is not the same as zero problems.`}
        {data.coverage?.newest_imported && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>
              Newest build with test logs: <span style={{ fontFamily: theme.mono, color: theme.text }}>{data.coverage.newest_imported}</span>
            </span>
            {jumpTarget && onJump && (
              <button
                type="button"
                onClick={onJump}
                title={`Switch the shift window to ${jumpTarget.from} → ${jumpTarget.to}`}
                style={{
                  border: `1px solid ${theme.primary}`,
                  background: "rgba(59, 130, 246, 0.16)",
                  color: theme.text,
                  borderRadius: 6,
                  padding: "3px 10px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Show that window
              </button>
            )}
          </div>
        )}
      </div>
    );
  } else if (!(data.architectures || []).length) {
    body = <PanelState kind="empty" text="No architectures in this comparison." />;
  } else {
    body = data.architectures.map((arch, idx) => <ArchSection key={arch.arch} arch={arch} first={idx === 0} />);
  }

  return (
    <div style={{ marginTop: 10, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "hidden", background: theme.surface }}>
      {data?.caveat && (
        <div
          style={{
            ...mutedNote,
            fontStyle: "normal",
            padding: "10px 14px",
            background: "rgba(148, 163, 184, 0.06)",
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <BsInfoCircle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          {data.caveat}
        </div>
      )}
      {body}
    </div>
  );
};

export default HiddenProblemsPanel;
