import { getSingleFile } from "../../Utils/ajax";
import { checkLabelType } from "../../Utils/processing";
import { config, showLabelConfig } from "../../config";

const { urls } = config;

export function fetchStructure() {
  return getSingleFile({ fileUrl: urls.releaseStructure }).then((res) => res.data);
}

export function fetchFlavorData(flavorName) {
  return getSingleFile({ fileUrl: urls.dataDir + flavorName + ".json" }).then((res) => res.data);
}

// comparisons[] carries one placeholder entry for the in-progress "next IB" (empty
// tests_archs) alongside real completed builds - drop it and sort newest-first by date.
export function listDatedBuilds(flavorData) {
  const comparisons = flavorData?.comparisons || [];
  return comparisons
    .filter((c) => Array.isArray(c.tests_archs) && c.tests_archs.length > 0)
    .sort((a, b) => (a.ib_date < b.ib_date ? 1 : a.ib_date > b.ib_date ? -1 : 0));
}

// Everything below mirrors IBPageComponents/ComparisonTable.js's exact per-category
// `passed`-state branching and groupFields, so the colors/counts shown here always agree
// with what the main IB Dashboard shows for the same underlying data.
const BUILD_GROUPS = [
  { groupFields: [(key) => key.includes("Error")], color: "danger" },
  { groupFields: ["compWarning"], color: "warning" },
];
const UTEST_ERROR_GROUPS = [{ groupFields: ["num_errors"], color: "danger" }];
const UTEST_FAILED_GROUPS = [{ groupFields: ["num_fails"], color: "danger" }];
const UTEST_WARNING_GROUPS = [{ groupFields: ["num_warnings"], color: "warning" }];

function fromGroups(entry, groups) {
  const label = checkLabelType(groups, entry.details || {});
  if (!label.value) return { status: "secondary", value: null };
  return { status: label.colorType, value: entry.done === false ? `${label.value}*` : label.value };
}

function findArchEntry(comparison, category, arch) {
  return (comparison[category] || []).find((r) => r.arch === arch);
}

export function summarizeArchCell(comparison, category, arch) {
  const entry = findArchEntry(comparison, category, arch);
  if (!entry) return { status: "missing", value: null };
  const { passed, details = {} } = entry;

  switch (category) {
    case "builds":
      if (passed === true || passed === "passed") return { status: "success", value: null };
      return fromGroups(entry, BUILD_GROUPS);

    case "utests":
      if (passed === true || passed === "passed") return { status: "success", value: details.num_passed ?? null };
      if (passed === false || passed === "error") return fromGroups(entry, UTEST_ERROR_GROUPS);
      if (passed === "failed") return fromGroups(entry, UTEST_FAILED_GROUPS);
      if (passed === "warning") return fromGroups(entry, UTEST_WARNING_GROUPS);
      return { status: "secondary", value: null };

    case "relvals":
      // The real dashboard funnels every passed-state through the same
      // num_failed/known_failed/num_passed check (showRelValsResults) rather than
      // branching on `passed` first - the count/color always comes from `details`.
      return fromGroups(entry, showLabelConfig.relvals || []);

    case "addons":
      if (passed === true) return { status: "success", value: null };
      if (passed === false || passed === "error") return { status: "danger", value: null };
      return fromGroups(entry, showLabelConfig.addons || []);

    case "dupDict":
      if (passed === true || passed === "passed") return { status: "success", value: null };
      if (passed === false || passed === "error") return { status: "danger", value: null };
      // config.js has no showLabelConfig.dupDict group - Q/A "failed"/"warning" states
      // have no count to show in the main dashboard either, so this stays a dash.
      return { status: "secondary", value: null };

    default:
      return { status: "secondary", value: null };
  }
}

// Total failing count for one category across all architectures in a comparison - the
// single number shown as a badge above each grid, and diffed between A/B in compare mode.
export function categoryFailingTotal(comparison, category) {
  const archs = comparison.tests_archs || [];
  return archs.reduce((sum, arch) => {
    const cell = summarizeArchCell(comparison, category, arch);
    if (cell.status !== "danger" || cell.value === null) return sum;
    const numeric = typeof cell.value === "number" ? cell.value : parseInt(cell.value, 10);
    return sum + (Number.isNaN(numeric) ? 0 : numeric);
  }, 0);
}

export const TREND_CATEGORIES = ["builds", "utests", "relvals", "addons", "dupDict"];

// datedBuilds is sorted newest-first (see listDatedBuilds). Slices out the inclusive
// span between two release names - whichever order the shifter picked them in - and
// returns it oldest-first, ready to plot left-to-right on a chart.
export function buildsBetween(datedBuilds, fromName, toName) {
  const fromIdx = datedBuilds.findIndex((b) => b.release_name === fromName);
  const toIdx = datedBuilds.findIndex((b) => b.release_name === toName);
  if (fromIdx === -1 || toIdx === -1) return [];
  const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
  return datedBuilds.slice(start, end + 1).slice().reverse();
}

// "CMSSW_20_1_X_2026-08-19-2300" -> "08-19 23:00"
export function shortBuildLabel(releaseName) {
  const match = /(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})$/.exec(releaseName || "");
  if (!match) return releaseName;
  const [, , mm, dd, hh, min] = match;
  return `${mm}-${dd} ${hh}:${min}`;
}

// One point per dated build, with each category's total-failing count - the series a
// trend chart plots.
export function buildTrendSeries(builds) {
  return builds.map((comparison) => {
    const point = { release_name: comparison.release_name, label: shortBuildLabel(comparison.release_name) };
    TREND_CATEGORIES.forEach((cat) => {
      point[cat] = categoryFailingTotal(comparison, cat);
    });
    return point;
  });
}
