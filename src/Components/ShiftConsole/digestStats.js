import { isEmptySection } from "./shiftMarkdown";

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
function tableRowSummary(header, row) {
  const normalized = header.map((h) => h.trim().toLowerCase());
  const cell = (name) => {
    const idx = normalized.indexOf(name);
    return idx !== -1 ? (row[idx] || "").trim() : "";
  };
  const name = cell("name") || cell("workflow");
  const detail = [cell("errors"), cell("exit code"), cell("warnings"), cell("status")].filter(Boolean).join(", ");
  return detail ? `${name} — ${detail}` : name || row.filter(Boolean).join(" — ");
}

// One line per row/bullet in a section, in the same order the Shift digest panel below
// already renders them - so the two views never disagree about what "the details" are.
function sectionDetailLines(section) {
  const lines = [];
  section.blocks.forEach((block) => {
    if (block.type === "table") block.rows.forEach((row) => lines.push(tableRowSummary(block.header, row)));
    else if (block.type === "list") block.items.forEach((item) => lines.push(item));
  });
  return lines;
}

const MAX_DETAIL_LINES = 6;

// Synthesizes alert-shaped entries - one per architecture per "new issue" section - from
// the digest currently on screen, so a shifter browsing a custom from/to comparison sees
// newly introduced errors surface in the Alerts panel automatically, with the actual
// workflow/warning detail attached, not just a bare count. The backend's
// /api/alerts/status only evaluates the live window; it has no notion of a manually
// picked comparison, so this always runs client-side against whatever digest just loaded.
export function buildComparisonAlerts(archs) {
  const alerts = [];
  (archs || []).forEach((arch) => {
    arch.sections.forEach((section) => {
      const isNewIssue = NEW_ISSUE_KEYS.some((key) => SECTION_PATTERNS[key].test(section.heading));
      if (!isNewIssue || isEmptySection(section)) return;
      const allLines = sectionDetailLines(section);
      alerts.push({
        rule: { rule_id: `comparison-${arch.name}-${section.heading}`, name: `${section.heading} — ${arch.name}` },
        message: `${allLines.length} item${allLines.length === 1 ? "" : "s"} introduced in ${arch.name}.`,
        details: allLines.slice(0, MAX_DETAIL_LINES),
        moreCount: Math.max(0, allLines.length - MAX_DETAIL_LINES),
        evidence: { count: allLines.length },
      });
    });
  });
  return alerts;
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
