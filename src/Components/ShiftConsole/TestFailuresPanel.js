import React, { useEffect, useState } from "react";
import { FaCubes, FaLayerGroup, FaPlus, FaVial } from "react-icons/fa";
import { FaClipboardList } from "react-icons/fa";
import { theme, TONE } from "./theme";
import { summarizeArchCell } from "./releaseExplorerData";
import PanelState from "./PanelState";
import WorkflowTable from "./WorkflowTable";

// Same five categories/icons/order as ReleaseStatusGrid's own CATEGORIES - a shifter who
// just read "RelVal 4" in the grid above sees the identical icon down here. Exported for
// CompareFailuresPanel (Compare mode's own pill switcher over the same five categories).
export const BADGE_ONLY_CATEGORIES = [
  { key: "builds", label: "Builds", icon: <FaCubes size={12} /> },
  { key: "addons", label: "AddOn", icon: <FaPlus size={12} /> },
  { key: "dupDict", label: "Q/A", icon: <FaClipboardList size={12} /> },
];

export const pillStyle = (active) => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  border: `1px solid ${active ? theme.primary : theme.border}`,
  background: active ? "rgba(59, 130, 246, 0.16)" : "transparent",
  color: active ? "#93c5fd" : theme.textSecondary,
  borderRadius: 999,
  padding: "5px 12px",
  fontSize: "0.78rem",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

export const countChip = (count) => ({
  fontSize: "0.7rem",
  fontWeight: 800,
  borderRadius: 999,
  padding: "0px 6px",
  color: count > 0 ? TONE.danger.fg : TONE.success.fg,
  background: count > 0 ? TONE.danger.tint : TONE.success.tint,
});

// Compact one-line-per-architecture list for Builds/AddOn/Q-A - there's no per-item data
// for these anywhere in the graph (a whole-architecture badge is all CMSDT ever tracks
// for them), so a shifter just needs "which architectures" rather than a full table.
// Exported for CompareFailuresPanel to render one of these per release, side by side.
export const BadgeOnlyList = ({ comparison, archs, categoryKey, label }) => {
  const failingArchs = (archs || []).filter((a) => summarizeArchCell(comparison, categoryKey, a).status === "danger");
  if (failingArchs.length === 0) {
    return <PanelState kind="empty" text={`No ${label.toLowerCase()} failures.`} />;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {failingArchs.map((a) => (
        <span
          key={a}
          style={{
            fontFamily: theme.mono,
            fontSize: "0.78rem",
            fontWeight: 600,
            color: TONE.danger.fg,
            background: TONE.danger.tint,
            border: `1px solid ${TONE.danger.ring}`,
            borderRadius: 8,
            padding: "3px 9px",
          }}
        >
          {a}
        </span>
      ))}
    </div>
  );
};

// header+rows built together, not separately - the hidden "highlight" column is only
// appended when a matching arch is actually hovered, and building it apart from the rows
// invites the header/row column counts silently drifting out of sync with each other.
function buildRelvalTable(items, highlightArch) {
  const header = ["Workflow", "Name", "Errors", "Exit Code", "Architecture", "Variant"];
  if (highlightArch) header.push("Highlight");
  const rows = items.map((r) => {
    const row = [String(r.workflow_id ?? ""), r.name || "", String(r.errors ?? ""), r.exit_code || "0", r.arch || "", r.variant || "primary"];
    if (highlightArch) row.push(r.arch === highlightArch ? "1" : "");
    return row;
  });
  return { header, rows };
}
function buildUnittestTable(items, highlightArch) {
  const header = ["Name", "Errors", "Architecture", "Variant"];
  if (highlightArch) header.push("Highlight");
  const rows = items.map((u) => {
    const row = [u.name || "", String(u.errors ?? ""), u.arch || "", u.variant || "primary"];
    if (highlightArch) row.push(u.arch === highlightArch ? "1" : "");
    return row;
  });
  return { header, rows };
}

// Sits directly below one release's Builds/Unit/RelVal/AddOn/Q-A status grid
// (ReleaseStatusGrid) in Single-build mode (Compare mode uses CompareFailuresPanel
// instead - a merged, single table per category so two releases' rows never need to
// "line up" against each other, they're the same row). That grid is built from the static
// per-flavor JSON CMSDT already publishes, which only ever carries per-architecture
// counts - never the actual failing workflow/unit-test identities, and nothing at all
// below the whole-architecture badge for Builds/AddOn/Q-A. This adds a compact pill row
// (one per category, matching the grid's own icons/order) that expands into either a
// searchable WorkflowTable (RelVal/Unit, fetched from the knowledge-graph backend) or a
// plain architecture-chip list (Builds/AddOn/Q-A, no finer data exists).
// `highlightCategory`/`highlightArch` (from ReleaseStatusGrid hovering a red RelVal/Unit
// circle above) ring-highlight the matching rows here and jump the pill switcher to that
// category, so hovering a failure count in the summary grid actually shows which
// workflows it is - in place, not a separate popup.
const TestFailuresPanel = ({ comparison, archs, failing, highlightCategory, highlightArch }) => {
  const [active, setActive] = useState("relvals");

  useEffect(() => {
    if (highlightCategory === "relvals" || highlightCategory === "utests") setActive(highlightCategory);
  }, [highlightCategory]);

  if (failing.loading) return <PanelState kind="loading" text="Loading failing workflows…" />;
  if (failing.error) return <PanelState kind="error" text="Couldn't load failing RelVal/unit test detail." />;

  const relvals = failing.data?.relvals || [];
  const unittests = failing.data?.unittests || [];
  const badgeCounts = Object.fromEntries(
    BADGE_ONLY_CATEGORIES.map((c) => [c.key, (archs || []).filter((a) => summarizeArchCell(comparison, c.key, a).status === "danger").length]),
  );

  const pills = [
    { key: "builds", label: "Builds", icon: <FaCubes size={12} />, count: badgeCounts.builds },
    { key: "utests", label: "Unit Tests", icon: <FaVial size={12} />, count: unittests.length },
    { key: "relvals", label: "RelVal", icon: <FaLayerGroup size={12} />, count: relvals.length },
    { key: "addons", label: "AddOn", icon: <FaPlus size={12} />, count: badgeCounts.addons },
    { key: "dupDict", label: "Q/A", icon: <FaClipboardList size={12} />, count: badgeCounts.dupDict },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {pills.map((p) => (
          <button key={p.key} type="button" onClick={() => setActive(p.key)} style={pillStyle(active === p.key)}>
            {p.icon}
            {p.label}
            <span style={countChip(p.count)}>{p.count}</span>
          </button>
        ))}
      </div>

      {active === "relvals" &&
        (relvals.length > 0 ? (
          <WorkflowTable light {...buildRelvalTable(relvals, highlightCategory === "relvals" ? highlightArch : null)} />
        ) : (
          <PanelState kind="empty" text="No failing RelVals." />
        ))}

      {active === "utests" &&
        (unittests.length > 0 ? (
          <WorkflowTable light {...buildUnittestTable(unittests, highlightCategory === "utests" ? highlightArch : null)} />
        ) : (
          <PanelState kind="empty" text="No failing unit tests." />
        ))}

      {active === "builds" && <BadgeOnlyList comparison={comparison} archs={archs} categoryKey="builds" label="Build" />}
      {active === "addons" && <BadgeOnlyList comparison={comparison} archs={archs} categoryKey="addons" label="AddOn" />}
      {active === "dupDict" && <BadgeOnlyList comparison={comparison} archs={archs} categoryKey="dupDict" label="Q/A" />}
    </div>
  );
};

export default TestFailuresPanel;
