import React, { useMemo, useState } from "react";
import { FaCubes, FaLayerGroup, FaPlus, FaVial } from "react-icons/fa";
import { FaClipboardList } from "react-icons/fa";
import { theme, TINT_SWATCH_COLORS } from "./theme";
import { summarizeArchCell } from "./releaseExplorerData";
import PanelState from "./PanelState";
import WorkflowTable from "./WorkflowTable";
import { BADGE_ONLY_CATEGORIES, BadgeOnlyList, countChip, pillStyle } from "./TestFailuresPanel";

// Compare mode's replacement for two independent per-release TestFailuresPanels: rather
// than rendering Release A's failing RelVals and Release B's failing RelVals as two
// separately-searched, separately-paginated tables side by side (which a shifter then has
// to manually cross-reference, and which can never actually stay visually aligned row for
// row once either side is searched, sorted, or paged independently), this merges both
// releases' failing lists into ONE table with one row per distinct (arch, variant,
// workflow/name) - there's nothing left to "line up" because a shared failure already
// *is* the same row. Rendered once, below both ReleaseColumns, not duplicated per side.

function relvalIdentity(row) {
  return `${row.arch}|${row.variant}|${row.workflow_id}`;
}
function unittestIdentity(row) {
  return `${row.arch}|${row.variant}|${row.name}`;
}

function mergePairs(itemsA, itemsB, identityFn) {
  const map = new Map();
  (itemsA || []).forEach((item) => map.set(identityFn(item), { a: item, b: null }));
  (itemsB || []).forEach((item) => {
    const key = identityFn(item);
    if (map.has(key)) map.get(key).b = item;
    else map.set(key, { a: null, b: item });
  });
  return [...map.values()];
}

// Sort every pair by (architecture, variant, identifier) regardless of which side(s)
// contributed it - a stable, deterministic order both releases' items fall into together,
// since there's only one row per pair there's nothing to keep in sync between two tables.
function sortPairs(pairs, idField) {
  return pairs.slice().sort((x, y) => {
    const rx = x.a || x.b;
    const ry = y.a || y.b;
    if (rx.arch !== ry.arch) return rx.arch < ry.arch ? -1 : 1;
    const vx = rx.variant || "primary";
    const vy = ry.variant || "primary";
    if (vx !== vy) return vx < vy ? -1 : 1;
    const ix = rx[idField];
    const iy = ry[idField];
    const nx = parseFloat(ix);
    const ny = parseFloat(iy);
    if (!Number.isNaN(nx) && !Number.isNaN(ny) && nx !== ny) return nx - ny;
    return String(ix).localeCompare(String(iy));
  });
}

// "125" / "125" (same) -> "125" · "125" / "122" (differ) -> "125 → 122" - one column
// instead of two side-by-side numeric columns per release, which doubled every numeric
// column width for little benefit (most failures share the same shape across releases).
function pairText(aVal, bVal) {
  const a = aVal === undefined || aVal === null || aVal === "" ? null : String(aVal);
  const b = bVal === undefined || bVal === null || bVal === "" ? null : String(bVal);
  if (a !== null && b !== null) return a === b ? a : `${a} → ${b}`;
  return a ?? b ?? "";
}

// One row's "In A"/"In B" cell values - a filled dot (in that release's TINT_SWATCH_COLORS
// hue) when present, a hollow "dot:empty" ring when not. Replaces the old wide "Both"/
// "Only A" text column *and* the old whole-row background tint with one thing: two small
// dots are enough on their own (shape as well as color, so it doesn't rely on color
// perception alone) - no separate legend text needed per row, no tint fighting with the
// row's own text for contrast.
function dotTokens(a, b) {
  if (a && b) return ["dot:both", "dot:both"];
  if (a) return ["dot:onlyA", "dot:empty"];
  return ["dot:empty", "dot:onlyB"];
}

// "el9_amd64_gcc14" (primary) or "el9_amd64_gcc14 (CLANG)" (sub-IB) - one column instead
// of two (Architecture + Variant separately), and it's what WorkflowTable's own search box
// matches against ("architecture" is a searchable column, "variant" on its own never was) -
// folding variant text in here means a shifter can now search by sub-IB name too.
function archLabel(ref) {
  const variant = ref.variant && ref.variant.toLowerCase() !== "primary" ? ref.variant : null;
  return variant ? `${ref.arch} (${variant})` : ref.arch || "";
}

function buildMergedRelvalTable(pairs, highlightArch) {
  const header = ["Workflow", "Name", "Errors", "Exit Code", "Architecture", "In A", "In B"];
  if (highlightArch) header.push("Highlight");
  const rows = pairs.map(({ a, b }) => {
    const ref = a || b;
    const [inA, inB] = dotTokens(a, b);
    const row = [String(ref.workflow_id ?? ""), ref.name || "", pairText(a?.errors, b?.errors), pairText(a?.exit_code, b?.exit_code), archLabel(ref), inA, inB];
    if (highlightArch) row.push(ref.arch === highlightArch ? "1" : "");
    return row;
  });
  return { header, rows };
}
function buildMergedUnittestTable(pairs, highlightArch) {
  const header = ["Name", "Errors", "Architecture", "In A", "In B"];
  if (highlightArch) header.push("Highlight");
  const rows = pairs.map(({ a, b }) => {
    const ref = a || b;
    const [inA, inB] = dotTokens(a, b);
    const row = [ref.name || "", pairText(a?.errors, b?.errors), archLabel(ref), inA, inB];
    if (highlightArch) row.push(ref.arch === highlightArch ? "1" : "");
    return row;
  });
  return { header, rows };
}

// Real release labels (short build labels, e.g. "09-08 23:00"), not generic "Release A"/
// "Release B" - a shifter reading the legend or a chip list shouldn't have to look back up
// at the pickers above to translate "A" into which actual build it means.
const Legend = ({ labelA, labelB }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 10, fontSize: "0.78rem", color: theme.textSecondary }}>
    {[
      { tint: "both", text: "Failing in both" },
      { tint: "onlyA", text: `Only in ${labelA}` },
      { tint: "onlyB", text: `Only in ${labelB}` },
    ].map(({ tint, text }) => (
      <span key={tint} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: TINT_SWATCH_COLORS[tint] }} />
        {text}
      </span>
    ))}
  </div>
);

const sectionLabel = { fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: theme.textMuted, marginBottom: 6 };

// Builds/AddOn/Q-A stay two side-by-side compact chip lists, not merged rows - there's no
// per-item identity to merge (a whole-architecture badge either failed or it didn't), and
// with typically only a handful of architectures, two short lists read faster than forcing
// them through the same union-and-diff machinery the per-item tables need.
const BadgeOnlyCompare = ({ comparisonA, comparisonB, archs, categoryKey, label, labelA, labelB }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
    <div style={{ flex: "1 1 260px" }}>
      <div style={sectionLabel}>{labelA}</div>
      <BadgeOnlyList comparison={comparisonA} archs={archs} categoryKey={categoryKey} label={label} />
    </div>
    <div style={{ flex: "1 1 260px" }}>
      <div style={sectionLabel}>{labelB}</div>
      <BadgeOnlyList comparison={comparisonB} archs={archs} categoryKey={categoryKey} label={label} />
    </div>
  </div>
);

// `highlight`: {category, arch} | null, from either ReleaseColumn's grid (see
// ReleaseExplorerPanel) - since a merged row's architecture is the same no matter which
// release(s) contributed it, which grid the hover came from doesn't change which rows
// light up, only its category/arch do.
const CompareFailuresPanel = ({ comparisonA, comparisonB, archs, failingA, failingB, highlight, labelA, labelB }) => {
  const [active, setActive] = useState("relvals");
  const columnLabels = { "in a": labelA, "in b": labelB };

  const relvalPairs = useMemo(
    () => sortPairs(mergePairs(failingA.data?.relvals, failingB.data?.relvals, relvalIdentity), "workflow_id"),
    [failingA.data, failingB.data],
  );
  const unittestPairs = useMemo(
    () => sortPairs(mergePairs(failingA.data?.unittests, failingB.data?.unittests, unittestIdentity), "name"),
    [failingA.data, failingB.data],
  );

  if (failingA.loading || failingB.loading) return <PanelState kind="loading" text="Loading failing workflows…" />;
  if (failingA.error || failingB.error) return <PanelState kind="error" text="Couldn't load failing RelVal/unit test detail." />;

  const badgeCount = (categoryKey) => {
    const a = new Set((archs || []).filter((arch) => summarizeArchCell(comparisonA, categoryKey, arch).status === "danger"));
    const b = (archs || []).filter((arch) => summarizeArchCell(comparisonB, categoryKey, arch).status === "danger");
    b.forEach((arch) => a.add(arch));
    return a.size;
  };
  const badgeCounts = Object.fromEntries(BADGE_ONLY_CATEGORIES.map((c) => [c.key, badgeCount(c.key)]));

  const pills = [
    { key: "builds", label: "Builds", icon: <FaCubes size={12} />, count: badgeCounts.builds },
    { key: "utests", label: "Unit Tests", icon: <FaVial size={12} />, count: unittestPairs.length },
    { key: "relvals", label: "RelVal", icon: <FaLayerGroup size={12} />, count: relvalPairs.length },
    { key: "addons", label: "AddOn", icon: <FaPlus size={12} />, count: badgeCounts.addons },
    { key: "dupDict", label: "Q/A", icon: <FaClipboardList size={12} />, count: badgeCounts.dupDict },
  ];

  const highlightArch = (category) => (highlight?.category === category ? highlight.arch : null);

  return (
    <div style={{ marginTop: 8 }}>
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
        (relvalPairs.length > 0 ? (
          <>
            <Legend labelA={labelA} labelB={labelB} />
            <WorkflowTable light columnLabels={columnLabels} {...buildMergedRelvalTable(relvalPairs, highlightArch("relvals"))} />
          </>
        ) : (
          <PanelState kind="empty" text="No failing RelVals in either release." />
        ))}

      {active === "utests" &&
        (unittestPairs.length > 0 ? (
          <>
            <Legend labelA={labelA} labelB={labelB} />
            <WorkflowTable light columnLabels={columnLabels} {...buildMergedUnittestTable(unittestPairs, highlightArch("utests"))} />
          </>
        ) : (
          <PanelState kind="empty" text="No failing unit tests in either release." />
        ))}

      {active === "builds" && (
        <BadgeOnlyCompare comparisonA={comparisonA} comparisonB={comparisonB} archs={archs} categoryKey="builds" label="Build" labelA={labelA} labelB={labelB} />
      )}
      {active === "addons" && (
        <BadgeOnlyCompare comparisonA={comparisonA} comparisonB={comparisonB} archs={archs} categoryKey="addons" label="AddOn" labelA={labelA} labelB={labelB} />
      )}
      {active === "dupDict" && (
        <BadgeOnlyCompare comparisonA={comparisonA} comparisonB={comparisonB} archs={archs} categoryKey="dupDict" label="Q/A" labelA={labelA} labelB={labelB} />
      )}
    </div>
  );
};

export default CompareFailuresPanel;
