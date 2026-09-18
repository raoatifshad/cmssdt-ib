import { isEmptySection } from "./shiftMarkdown";
import { parseEvidenceMentions } from "./prIssueEvidence";

// Counts rows/items in a single #### section (a table or a bullet list) so severity can
// be surfaced as a number without a shifter opening it.
export function sectionItemCount(section) {
  if (!section) return 0;
  return section.blocks.reduce((n, block) => {
    if (block.type === "table") return n + block.rows.length;
    if (block.type === "list") return n + block.items.length;
    return n;
  }, 0);
}

function findSection(arch, pattern) {
  return arch.sections.find((section) => pattern.test(section.heading));
}

// Matches the fixed set of #### headings the backend emits per architecture (see
// shiftMarkdown.js buildDigestDocument). Unrecognized headings just don't contribute to
// the counts - they still render, via the "other" bucket in classifySection below.
// Builds/Unit Tests/AddOn tests follow the backend prompt in the shift-summary contract
// doc: same per-arch "Newly failing X" / "Resolved X" table pair RelVal/Clang already use.
const SECTION_PATTERNS = {
  newFailing: /newly failing relval/i,
  resolved: /resolved relval/i,
  newWarnings: /new clang warning/i,
  resolvedWarnings: /resolved clang warning/i,
  changedWarnings: /changed clang warning/i,
  newFailingBuilds: /newly failing build/i,
  resolvedBuilds: /resolved build/i,
  newFailingUtests: /newly failing unit test/i,
  resolvedUtests: /resolved unit test/i,
  newFailingAddons: /newly failing addon/i,
  resolvedAddons: /resolved addon/i,
};

// Which SECTION_PATTERNS keys mean "something new broke" vs. good news ("resolved") -
// the single list both aggregateStats' archsWithFailures and buildComparisonAlerts key off,
// so a category added to SECTION_PATTERNS only has to be listed here once.
const NEW_ISSUE_KEYS = ["newFailing", "newWarnings", "newFailingBuilds", "newFailingUtests", "newFailingAddons"];

export function archStats(arch) {
  const stats = {};
  Object.entries(SECTION_PATTERNS).forEach(([key, pattern]) => {
    const section = findSection(arch, pattern);
    stats[key] = section && !isEmptySection(section) ? sectionItemCount(section) : 0;
  });
  return stats;
}

export function aggregateStats(archs) {
  const totals = Object.fromEntries(Object.keys(SECTION_PATTERNS).map((key) => [key, 0]));
  totals.archsWithFailures = 0;
  archs.forEach((arch) => {
    const s = archStats(arch);
    Object.keys(SECTION_PATTERNS).forEach((key) => {
      totals[key] += s[key];
    });
    if (NEW_ISSUE_KEYS.some((key) => s[key] > 0)) totals.archsWithFailures += 1;
  });
  return totals;
}

// Same column names WorkflowTable.js already looks for (PRIMARY_COLUMNS) - reusing them
// here means an alert's detail line names the same fields the digest table itself shows.
// Returns {name, detail, prIssue} rather than one flattened string so AlertsPanel can render
// just the identifier on one line and put everything else - including the human-readable Name
// column - behind a click. A card with 20 full "id — name — errors, exit code, ..." lines
// was taking over the whole Alerts panel. `prIssue` (parsed from the same "PR/Issue Evidence"
// cell WorkflowTable's evidence drawer already reads - see prIssueEvidence.js) is kept
// structured rather than folded into `detail`'s text so AlertsPanel can show it as its own
// always-visible badge instead of text buried behind a click - a shifter deciding whether a
// failure is already known/tracked shouldn't have to expand every row to find out.
//
// The one-line label folds in architecture and sub-IB (build "type", e.g. ASAN/MULTIARCHS/
// ROOT6 - see the CMSSDT release-matrix TYPE columns) so it's self-describing even read out
// of the card's own context, not just relying on the card header a shifter might not see
// (screenshots, copy-paste, scrolling past it). This also disambiguates real cases where
// the same workflow_id fails on the same architecture under two different build types (or
// even the same build type on two different architectures, e.g. ROOT6 exists on both
// el9_amd64_gcc14 and el9_aarch64_gcc14 for the same tag) - each would otherwise render as
// an identical-looking duplicate line.
function tableRowSummary(header, row, archName) {
  const normalized = header.map((h) => h.trim().toLowerCase());
  const cell = (fieldName) => {
    const idx = normalized.indexOf(fieldName);
    return idx !== -1 ? (row[idx] || "").trim() : "";
  };
  const workflowId = cell("workflow");
  const variant = cell("variant");
  const isSubIb = !!variant && variant.toLowerCase() !== "primary";
  const identifier = workflowId || cell("name") || row.filter(Boolean).join(" — ");
  const name = [identifier, archName, isSubIb ? variant : null].filter(Boolean).join(" · ");
  // Only fold "Name" into the detail line when it wasn't already used as the identifier above.
  const detailFieldNames = workflowId ? ["name", "errors", "exit code", "warnings", "status"] : ["errors", "exit code", "warnings", "status"];
  // Kept as one {field, label, value} per recognized column (rather than one pre-joined
  // string) so a renderer can color each field's label differently - "Name"/"Errors"/
  // "Exit code" all in the same flat muted-gray sentence read as one blob at a glance,
  // exactly the fields a shifter most needs to tell apart. `detail` (the old flattened
  // string) is kept alongside for callers that only need a plain-text rendering.
  const detailFields = detailFieldNames
    .map((fieldName) => {
      const value = cell(fieldName);
      return value ? { field: fieldName, label: header[normalized.indexOf(fieldName)], value } : null;
    })
    .filter(Boolean);
  const detail = detailFields.map(({ label, value }) => `${label}: ${value}`).join(" · ");
  const prIssue = parseEvidenceMentions(cell("pr/issue evidence"));
  return { name, detail, detailFields, prIssue: prIssue.length ? prIssue : null };
}

// One entry per row/bullet in a section, in the same order the Shift digest panel below
// already renders them - so the two views never disagree about what "the details" are.
function sectionDetailLines(section, archName) {
  const lines = [];
  section.blocks.forEach((block) => {
    if (block.type === "table") block.rows.forEach((row) => lines.push(tableRowSummary(block.header, row, archName)));
    else if (block.type === "list") block.items.forEach((item) => lines.push({ name: item, detail: "" }));
  });
  return lines;
}

export const MAX_DETAIL_LINES = 6;

// Per-category phrasing for a comparison alert's one-line subtitle - "N item(s) introduced"
// read as generic filler once the row already has a category icon/title above it. Naming
// what actually broke (workflow/unit test/build/AddOn test) reads better. "other" keeps the
// old generic phrasing as a fallback for any future digest section classifySection doesn't
// recognize yet.
const CATEGORY_ALERT_MESSAGE = {
  relval: (n) => `${n} workflow${n === 1 ? "" : "s"} newly failing`,
  utests: (n) => `${n} unit test${n === 1 ? "" : "s"} newly failing`,
  builds: (n) => `${n} build${n === 1 ? "" : "s"} newly failing`,
  addons: (n) => `${n} AddOn test${n === 1 ? "" : "s"} newly failing`,
  clang: (n) => `${n} new clang warning${n === 1 ? "" : "s"}`,
  other: (n) => `${n} item${n === 1 ? "" : "s"} introduced`,
};

// Display order for the one alert-per-category Recent Problems now produces - fixed rather
// than "whichever arch/category combo happened to fail first", so the feed doesn't reorder
// itself between comparisons just because a different architecture broke first this time.
const CATEGORY_ORDER = ["relval", "builds", "utests", "addons", "clang", "other"];

// Synthesizes one alert-shaped entry per category ("RelVal failure", "Unit test failures",
// ...) from the digest currently on screen, merging every architecture's items for that
// category into a single card's detail list instead of splitting them arch-by-arch - a
// shifter cares that RelVals broke, not that it happened to be reported as two cards because
// two architectures were affected. Each detail line still carries its own architecture (see
// tableRowSummary), so the per-arch breakdown survives as a drill-down inside the one card.
//
// This is Recent Problems' only data source, so it always reflects whatever comparison is
// currently loaded - latest-vs-previous by default, or a shifter-picked window - and can
// never disagree with the Shift Digest scoreboard below it, which reads the same digest.
//
// `windowLabel` ("<from tag> → <to tag>", from the digest's own parsed title - see
// ShiftConsolePage's parseDigestWindow) is stamped onto every alert this produces so each
// row's evidence is traceable back to the exact comparison that produced it. `releaseCycle`
// (e.g. "CMSSW_20_1_X", from ShiftConsolePage's own releaseCycle() helper) is stamped
// alongside it - the window label alone is two full release names, and a shifter scanning
// Recent Problems wants "which cycle" at a glance without parsing them.
export function buildComparisonAlerts(archs, windowLabel, releaseCycle) {
  const grouped = new Map(); // category -> Map<archLabel, items[]>
  (archs || []).forEach((arch) => {
    // arch.name carries the backend markdown's literal backticks (e.g. "`el9_amd64_gcc14`",
    // meant for renderInline elsewhere) - strip them here since each item's one-line label
    // renders as plain text, not markdown.
    const archLabel = arch.name.replace(/`/g, "");
    arch.sections.forEach((section) => {
      const isNewIssue = NEW_ISSUE_KEYS.some((key) => SECTION_PATTERNS[key].test(section.heading));
      if (!isNewIssue || isEmptySection(section)) return;
      const category = classifySection(section.heading);
      if (!grouped.has(category)) grouped.set(category, new Map());
      const byArch = grouped.get(category);
      if (!byArch.has(archLabel)) byArch.set(archLabel, []);
      // archName passed as "" - each item renders under its own arch's group heading (built
      // below), so repeating the architecture inside every item's own label (see
      // tableRowSummary) would just be noise. Same pattern categoryItemsByArch already uses.
      byArch.get(archLabel).push(...sectionDetailLines(section, ""));
    });
  });

  return CATEGORY_ORDER.filter((category) => grouped.has(category)).map((category) => {
    const byArch = grouped.get(category);
    const archLabels = [...byArch.keys()];
    const totalCount = archLabels.reduce((n, archLabel) => n + byArch.get(archLabel).length, 0);

    // MAX_DETAIL_LINES is a budget for the whole card, spent architecture-by-architecture in
    // order - so a card spanning several architectures still shows a slice of each one
    // instead of only ever expanding into the first.
    let budget = MAX_DETAIL_LINES;
    const archGroups = archLabels.map((archLabel) => {
      const items = byArch.get(archLabel);
      const shown = items.slice(0, budget);
      budget = Math.max(0, budget - shown.length);
      return { archLabel, items: shown, moreCount: items.length - shown.length };
    });

    return {
      rule: { rule_id: `comparison-${category}`, name: category },
      // Which digest group this belongs to (relval/utests/builds/addons/clang) - lets
      // AlertsPanel show a category icon and a human title ("RelVal failure") so a
      // shifter can tell a RelVal alert from a Unit Test alert at a glance, without the
      // severity color itself having to vary.
      category,
      // Every architecture this category is failing on, shown as its own chip on the card
      // (rather than collapsed to a count) - and as its own drill-down group in archGroups.
      archLabels,
      releaseCycle: releaseCycle || null,
      windowLabel: windowLabel || null,
      message: (CATEGORY_ALERT_MESSAGE[category] || CATEGORY_ALERT_MESSAGE.other)(totalCount),
      archGroups,
      evidence: { count: totalCount },
    };
  });
}

// category+side -> the SECTION_PATTERNS key that covers it - lets categoryItemsByArch look
// up the right section without a shifter-facing category name ("relval"/"builds"/...)
// needing to know SECTION_PATTERNS' internal key spelling.
const CATEGORY_SECTION_KEYS = {
  relval: { new: "newFailing", resolved: "resolved" },
  builds: { new: "newFailingBuilds", resolved: "resolvedBuilds" },
  utests: { new: "newFailingUtests", resolved: "resolvedUtests" },
  addons: { new: "newFailingAddons", resolved: "resolvedAddons" },
  clang: { new: "newWarnings", resolved: "resolvedWarnings" },
};

// The actual workflow/build/test names for one category+side (e.g. "builds"/"new"),
// grouped by architecture - archStats()/aggregateStats() only ever return a count for
// this same data, which is fine for a page-wide total but not enough once a shifter drills
// into a single scoreboard tile and actually wants to know *which* workflow. One entry per
// architecture that has at least one item; architectures with nothing in this category are
// left out rather than rendered as an empty group.
export function categoryItemsByArch(archs, category, side) {
  const sectionKey = CATEGORY_SECTION_KEYS[category]?.[side];
  if (!sectionKey) return [];
  const pattern = SECTION_PATTERNS[sectionKey];
  return (archs || [])
    .map((arch) => {
      const section = findSection(arch, pattern);
      if (!section || isEmptySection(section)) return null;
      // archName passed as "" - the group header this feeds already names the architecture,
      // so repeating it inside every item's own label (see tableRowSummary) would be noise.
      return { name: arch.name.replace(/`/g, ""), items: sectionDetailLines(section, "") };
    })
    .filter(Boolean);
}

// Groups a section's #### heading into the card it belongs under. "other" is a fallback
// for any future backend heading that doesn't mention one of these known categories, so
// new content still renders instead of silently disappearing.
export function classifySection(heading) {
  if (/relval/i.test(heading)) return "relval";
  if (/clang/i.test(heading)) return "clang";
  if (/build/i.test(heading)) return "builds";
  if (/unit test/i.test(heading)) return "utests";
  if (/addon/i.test(heading)) return "addons";
  return "other";
}
