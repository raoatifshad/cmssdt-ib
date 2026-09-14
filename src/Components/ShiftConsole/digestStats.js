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
// Returns {name, detail} rather than one flattened string so AlertsPanel can render just
// the identifier on one line and put everything else - including the human-readable Name
// column - behind a click. A card with 20 full "id — name — errors, exit code, ..." lines
// was taking over the whole Alerts panel.
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
  const detailFields = workflowId ? ["name", "errors", "exit code", "warnings", "status"] : ["errors", "exit code", "warnings", "status"];
  const detail = detailFields
    .map((fieldName) => {
      const value = cell(fieldName);
      return value ? `${header[normalized.indexOf(fieldName)]}: ${value}` : null;
    })
    .filter(Boolean)
    .join(" · ");
  return { name, detail };
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
// what actually broke (workflow/unit test/build/AddOn test) reads better and lines up with
// normalizeBackendAlert's "N newly failing since the previous build" wording for the
// backend's *_regression alerts, so the two alert sources don't read inconsistently side by
// side. "other" keeps the old generic phrasing as a fallback for any future digest section
// classifySection doesn't recognize yet.
const CATEGORY_ALERT_MESSAGE = {
  relval: (n) => `${n} workflow${n === 1 ? "" : "s"} newly failing`,
  utests: (n) => `${n} unit test${n === 1 ? "" : "s"} newly failing`,
  builds: (n) => `${n} build${n === 1 ? "" : "s"} newly failing`,
  addons: (n) => `${n} AddOn test${n === 1 ? "" : "s"} newly failing`,
  clang: (n) => `${n} new clang warning${n === 1 ? "" : "s"}`,
  other: (n) => `${n} item${n === 1 ? "" : "s"} introduced`,
};

// Synthesizes alert-shaped entries - one per architecture per "new issue" section - from
// the digest currently on screen, so a shifter browsing a custom from/to comparison sees
// newly introduced errors surface in the Alerts panel automatically, with the actual
// workflow/warning detail attached, not just a bare count. The backend's
// /api/alerts/status only evaluates the live window; it has no notion of a manually
// picked comparison, so this always runs client-side against whatever digest just loaded.
export function buildComparisonAlerts(archs) {
  const alerts = [];
  (archs || []).forEach((arch) => {
    // arch.name carries the backend markdown's literal backticks (e.g. "`el9_amd64_gcc14`",
    // meant for renderInline elsewhere) - strip them here since the alert card title and
    // each item's one-line label render as plain text, not markdown.
    const archLabel = arch.name.replace(/`/g, "");
    arch.sections.forEach((section) => {
      const isNewIssue = NEW_ISSUE_KEYS.some((key) => SECTION_PATTERNS[key].test(section.heading));
      if (!isNewIssue || isEmptySection(section)) return;
      const allLines = sectionDetailLines(section, archLabel);
      const category = classifySection(section.heading);
      alerts.push({
        rule: { rule_id: `comparison-${arch.name}-${section.heading}`, name: section.heading },
        // Which digest group this belongs to (relval/utests/builds/addons/clang) - lets
        // AlertsPanel show a category icon and a human title ("RelVal failure") so a
        // shifter can tell a RelVal alert from a Unit Test alert at a glance, without the
        // severity color itself having to vary.
        category,
        // Kept separate from the message (rather than folded into rule.name, as before) so
        // AlertsPanel can render it as its own small subtitle next to the category title -
        // the architecture matters, but it isn't part of "what kind of problem is this".
        archLabel,
        message: (CATEGORY_ALERT_MESSAGE[category] || CATEGORY_ALERT_MESSAGE.other)(allLines.length),
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

// Maps the backend's three dynamic "*_regression" AlertRule types (graph/alerts.py --
// each fires one combined alert covering DEFAULT + every sub-IB, diffed against its own
// previous build) onto the same category keys classifySection uses, so they get the same
// icon/title treatment as the digest-synthesized alerts instead of a generic bell.
// build_regression covers both Build and AddOn badges in one check (see find_build_regressions
// in graph/tools.py) -- there's no way to split it into two categories up front, so it's
// grouped under "builds" and each item's own `kind` ("build"/"addon") still shows per-row.
const REGRESSION_RULE_CATEGORY = {
  relval_regression: "relval",
  unittest_regression: "utests",
  build_regression: "builds",
};

// One evidence.newly_failing item -> the same {name, detail} shape tableRowSummary produces,
// so AlertDetailItem renders it identically to a digest-comparison alert's rows.
function regressionItemLine(item) {
  const variantLabel = item.variant && item.variant.toLowerCase() !== "primary" ? item.variant : null;
  if ("workflow_id" in item) {
    return { name: [item.workflow_id, item.arch, variantLabel].filter(Boolean).join(" · "), detail: item.name || "" };
  }
  if ("kind" in item) {
    return { name: [item.kind, item.arch, variantLabel].filter(Boolean).join(" · "), detail: "" };
  }
  // unittest_regression items: {name, arch, variant}
  return { name: [item.name, item.arch, variantLabel].filter(Boolean).join(" · "), detail: "" };
}

// GET /api/alerts/status returns {rule, message, evidence} straight from evaluate_rules() --
// fine as-is for the 5 older fixed-tag rule types (they already read well as a single message
// line), but the 3 dynamic regression types pack up to 20 items into one long message string
// with no category/details, so AlertsPanel can't give them the same icon + expandable
// per-workflow list the digest-comparison alerts get. This reshapes just those three into
// that same alert shape; every other rule_type passes through unchanged.
export function normalizeBackendAlert(alert) {
  const ruleType = alert.rule?.rule_type;
  const category = REGRESSION_RULE_CATEGORY[ruleType];
  if (!category) return alert;

  const evidence = alert.evidence || {};
  const items = evidence.newly_failing || [];
  const archLabel =
    evidence.previous_tag && evidence.latest_tag ? `${evidence.previous_tag} → ${evidence.latest_tag}` : alert.rule?.params?.arch || null;

  return {
    ...alert,
    category,
    archLabel,
    message: `${evidence.count ?? items.length} newly failing since the previous build`,
    details: items.slice(0, MAX_DETAIL_LINES).map(regressionItemLine),
    moreCount: Math.max(0, items.length - MAX_DETAIL_LINES),
  };
}
