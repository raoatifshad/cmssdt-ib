// Helpers for GET /api/test-log-problems: problems found in the raw logs of tests and
// RelVal steps the dashboard reports as PASSED (fatal exceptions, sanitizer reports,
// crashes, Python tracebacks, ...). Failed tests are not in this data - the other tiles
// already cover those.

// Shifter-facing names for the backend's `kind` values; unknown kinds fall back to the raw
// value with underscores spaced out, so a new kind still renders.
const KIND_LABEL = {
  ubsan: "UBSan",
  asan: "ASan",
  tsan: "TSan",
  fatal_exception: "Fatal exception",
  python_traceback: "Python traceback",
  crash: "Crash",
  assertion: "Assertion",
  infrastructure: "Infrastructure",
};

export function kindLabel(kind) {
  return KIND_LABEL[kind] || String(kind || "problem").replace(/_/g, " ");
}

// "UBSan · runtime error" - the category is dropped when it only repeats the kind.
export function kindChipText(group) {
  const kind = kindLabel(group.kind);
  const category = (group.category || "").trim();
  return category && category.toLowerCase() !== kind.toLowerCase() ? `${kind} · ${category}` : kind;
}

// "UBSAN" / "primary · gpu/nvidia_h100" - the same build can run on a GPU or another
// setup, and without the run_variant two rows for one test look like duplicates.
export function variantLabel(item) {
  return [item.variant || "primary", item.run_variant].filter(Boolean).join(" · ");
}

export const SUITE_LABEL = { unit: "Unit test", addon: "AddOn", relval: "RelVal" };

function trackKey(item) {
  return [item.variant || "", item.run_variant || "", item.suite || ""].join("|");
}

// track key -> baseline_note, for every track of one architecture compared against a
// build other than "from" - looked up per test row so the note shows wherever that
// variant appears.
export function baselineNotesByTrack(arch) {
  const notes = new Map();
  (arch.tracks || []).forEach((t) => {
    if (t.baseline_note) notes.set(trackKey(t), t.baseline_note);
  });
  return notes;
}

export function baselineNoteFor(notes, test) {
  return notes.get(trackKey(test)) || null;
}

// One line per distinct note per architecture, naming the variants it applies to - the
// backend repeats the same note for every suite/run of a variant.
export function summarizeBaselineNotes(arch) {
  const byNote = new Map();
  (arch.tracks || []).forEach((t) => {
    if (!t.baseline_note) return;
    if (!byNote.has(t.baseline_note)) byNote.set(t.baseline_note, new Set());
    byNote.get(t.baseline_note).add(t.variant || "primary");
  });
  return [...byNote.entries()].map(([note, variants]) => ({ note, variants: [...variants] }));
}

// "where to look": a file inside a zip on cmssdt9-02, not a URL.
export function logLocation(log) {
  if (!log || !log.server_path) return null;
  const member = log.member ? ` → ${log.member}` : "";
  const line = log.line != null ? `, line ${log.line}` : "";
  return `${log.server_path}${member}${line}`;
}

const MAX_ALERT_ITEMS = 6;

// The one Recent Problems entry for this data, shaped like buildComparisonAlerts()'s
// entries so AlertsPanel renders it the same way. Only for NEW problems (never for
// intermittent/gone), and never when the "to" build's logs aren't imported yet - an empty
// result there means "unknown", not "zero".
export function buildLogProblemsAlert(data, windowLabel, releaseCycle) {
  if (!data || !data.coverage?.to_imported) return null;
  const total = data.totals?.new_problems || 0;
  if (total <= 0) return null;

  let budget = MAX_ALERT_ITEMS;
  const archGroups = (data.architectures || [])
    .filter((arch) => arch.new?.length)
    .map((arch) => {
      const shown = arch.new.slice(0, budget);
      budget = Math.max(0, budget - shown.length);
      return {
        archLabel: arch.arch,
        moreCount: arch.new.length - shown.length,
        items: shown.map((group) => ({
          name: group.summary,
          detailFields: [
            { field: "kind", label: "Kind", value: kindChipText(group) },
            group.first_seen_tag && { field: "known", label: "Problem known since", value: group.first_seen_tag },
            {
              field: "tests",
              label: group.tests.length === 1 ? "Test" : `Tests (${group.tests.length})`,
              value: group.tests.map((t) => `${t.name} [${variantLabel(t)}]`).join(", "),
            },
            group.intentional_hint && { field: "hint", label: "Log says intentional", value: group.intentional_hint },
          ].filter(Boolean),
          exception: group.evidence || "",
          rawException: true,
        })),
      };
    });

  return {
    rule: { rule_id: "comparison-logProblems", name: "logProblems" },
    category: "logProblems",
    archLabels: archGroups.map((g) => g.archLabel),
    releaseCycle: releaseCycle || null,
    windowLabel: windowLabel || null,
    message: `${total} new`,
    archGroups,
    moreHint: "open the Hidden problems tile below",
    evidence: { count: total },
  };
}
