import _ from 'underscore';
import { checkIfTableIsEmpty, checkLabelType, getInfoFromRelease } from '../../Utils/processing';
import { showLabelConfig } from '../../config';
import { urls as relValUrls } from '../../relValConfig';

const TABLE_FIELDS = ['builds', 'utests', 'relvals', 'addons', 'dupDict'];

// How ComparisonTable counts the Builds and Unit tests rows. Shared so a delta always compares
// the same numbers the cell displays.
export const BUILD_LABELS = [
  { groupFields: [(key) => key.includes('Error')], color: 'danger' },
  { groupFields: ['compWarning'], color: 'warning' }
];

export const UTEST_LABELS = {
  error: [{ groupFields: ['num_errors'], color: 'danger' }],
  failed: [{ groupFields: ['num_fails'], color: 'danger' }],
  warning: [{ groupFields: ['num_warnings'], color: 'warning' }]
};

const STATUS_BY_RESULT = {
  true: 'passed',
  passed: 'passed',
  false: 'error',
  error: 'error',
  failed: 'failed',
  warning: 'warning'
};

const NOUNS = {
  builds: { failure: 'build error', warning: 'warning' },
  utests: { failure: 'unit test failure', warning: 'warning' },
  relvals: { failure: 'failed workflow', warning: 'known failure' },
  addons: { failure: 'failed test', warning: 'warning' },
  dupDict: { failure: 'duplicate problem', warning: 'warning' }
};

const PASSING = { failing: false, failures: 0, warnings: 0 };
// AddOn and Q/A failures can be reported as a bare X with no number.
const FAILING_WITHOUT_COUNT = { failing: true, failures: null, warnings: 0 };

const tierCount = (tier, details) => {
  const { value } = checkLabelType([tier], details);
  return Number.isFinite(value) ? value : 0;
};

const countForColor = (labels, details, color) =>
  labels
    .filter((tier) => tier.color === color)
    .reduce((sum, tier) => sum + tierCount(tier, details), 0);

// Returns what a cell displays as { failing, failures, warnings }, or null when it can't be
// compared: no result, still running, not ready, or a cell that renders as "-".
export function getCellMetric(resultType, result) {
  if (!result || _.isEmpty(result) || result.done === false || result.file === 'not-ready') return null;

  const status = STATUS_BY_RESULT[String(result.passed)];
  if (!status) return null;

  let labels;
  if (resultType === 'relvals') {
    // RelVal cells are drawn from their counts whatever the status says.
    labels = showLabelConfig.relvals;
  } else if (status === 'passed') {
    return PASSING;
  } else if (resultType === 'builds') {
    labels = BUILD_LABELS;
  } else if (resultType === 'utests') {
    labels = UTEST_LABELS[status];
  } else if (resultType === 'addons' || resultType === 'dupDict') {
    if (status === 'error') return FAILING_WITHOUT_COUNT;
    labels = (resultType === 'addons' && showLabelConfig.addons) || [];
  } else {
    return null;
  }

  const details = result.details || {};
  if (!labels.some((tier) => tierCount(tier, details) > 0)) return null;

  const failures = countForColor(labels, details, 'danger');
  return { failing: failures > 0, failures, warnings: countForColor(labels, details, 'warning') };
}

const countOf = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

const changeText = (before, after, noun) => `${before} → ${countOf(after, noun)}`;

function describeCountChange({ before, after, noun, upTone }) {
  const diff = after - before;
  const counts = { change: changeText(before, after, noun), previousCount: before, currentCount: after };
  if (diff === 0) return { kind: 'same', label: '=', tone: 'neutral', ...counts };
  return diff > 0
    ? { kind: 'up', label: `↑ +${diff}`, tone: upTone, ...counts }
    : { kind: 'down', label: `↓ ${diff}`, tone: 'good', ...counts };
}

// Which counts have names in the per-architecture data files.
const NAMED_COUNTS = { relvals: ['failure', 'warning'], utests: ['failure'] };

// Compares one cell with the same flavor and architecture in the previous IB. Returns null when
// nothing should be shown: nothing to compare with, or passing in both IBs.
export function getCellDelta(resultType, currentResult, previousResult, previousName, isPreviousIb = true) {
  const current = getCellMetric(resultType, currentResult);
  const previous = getCellMetric(resultType, previousResult);
  if (!current || !previous) return null;

  const nouns = NOUNS[resultType];
  const nameKindFor = (kind) => (NAMED_COUNTS[resultType]?.includes(kind) ? kind : null);
  const base = { previousName, isPreviousIb, nameKind: nameKindFor('failure') };

  if (current.failures === null || previous.failures === null) {
    if (current.failing && !previous.failing) {
      return { ...base, kind: 'new', label: 'New', tone: 'bad', change: 'Passing → failing', nameKind: null };
    }
    if (!current.failing && previous.failing) {
      return { ...base, kind: 'fixed', label: 'Fixed', tone: 'good', change: 'Failing → passing', nameKind: null };
    }
    return { ...base, kind: 'same', label: '=', tone: 'neutral', change: 'Failing → failing', nameKind: null };
  }

  const failureCounts = {
    change: changeText(previous.failures, current.failures, nouns.failure),
    previousCount: previous.failures,
    currentCount: current.failures
  };
  if (current.failing && !previous.failing) {
    return { ...base, ...failureCounts, kind: 'new', label: 'New', tone: 'bad' };
  }
  if (!current.failing && previous.failing) {
    return { ...base, ...failureCounts, kind: 'fixed', label: 'Fixed', tone: 'good' };
  }
  if (current.failing) {
    return {
      ...base,
      ...describeCountChange({
        before: previous.failures,
        after: current.failures,
        noun: nouns.failure,
        upTone: 'bad'
      })
    };
  }
  if (current.warnings === 0 && previous.warnings === 0) return null;
  return {
    ...base,
    nameKind: nameKindFor('warning'),
    ...describeCountChange({
      before: previous.warnings,
      after: current.warnings,
      noun: nouns.warning,
      upTone: 'caution'
    })
  };
}

const NAME_FOLDERS = { relvals: 'relvals', utests: 'unitTests' };

export function getNameFileUrl(resultType, ib, arch) {
  const date = getInfoFromRelease(ib.release_name)[3];
  return `${relValUrls.relValDataDir}${NAME_FOLDERS[resultType]}/${arch}/${date}/${ib.release_queue}.json`;
}

const relValFailed = (workflow) =>
  (workflow.steps || []).some((step) => !['PASSED', 'NOTRUN', '', undefined].includes(step.status));

// Reads names from a per-architecture data file. Returns { names, count }, where count is
// comparable with the table's number, or null if the file isn't in the expected format.
// Unit test files only name packages, each with its number of failures.
export function getResultNames(resultType, nameKind, fileData) {
  if (!Array.isArray(fileData)) return null;

  if (resultType === 'relvals') {
    const wantKnown = nameKind === 'warning';
    const names = fileData
      .filter((workflow) => relValFailed(workflow) && !!workflow.known_error === wantKnown)
      .map((workflow) => ({ key: workflow.id, label: `${workflow.id} ${workflow.name}` }));
    return { names, count: names.length };
  }

  const failing = fileData.filter((item) => Number(item.errors) > 0);
  return {
    names: failing.map((item) => ({
      key: item.name,
      label: Number(item.errors) > 1 ? `${item.name} (${item.errors})` : item.name
    })),
    count: failing.reduce((sum, item) => sum + Number(item.errors), 0)
  };
}

export function compareNames(currentNames, previousNames) {
  const currentKeys = new Set(currentNames.map((item) => item.key));
  const previousKeys = new Set(previousNames.map((item) => item.key));
  return {
    added: currentNames.filter((item) => !previousKeys.has(item.key)),
    removed: previousNames.filter((item) => !currentKeys.has(item.key)),
    kept: currentNames.filter((item) => previousKeys.has(item.key))
  };
}

const hasFinishedResult = (ib, arch) =>
  TABLE_FIELDS.some((field) => getCellMetric(field, _.findWhere(ib[field] || [], { arch })));

// Maps each IB in the latest group to Map(arch -> { ib, isPreviousIb }), where ib is the last older
// IB of the same flavor where that arch has a finished result, and isPreviousIb says whether it's
// the IB right before the latest. Flavors and architectures don't all run in every IB, so each column
// searches back on its own. Older IBs get no entry, so only the latest table shows changes.
// IBs with no results are skipped because IBGroupFrame shows no table for them, so a newly
// created IB doesn't take "latest" until it has a table to show the changes in.
// `groups` must be newest first and unfiltered, so a page filter never changes the baseline.
export function buildPreviousIbLookup(groups = []) {
  const ibGroups = groups
    .map((group) => (group || []).filter((ib) => ib && ib.isIB === true))
    .filter((ibs) => !checkIfTableIsEmpty({ fieldsToCheck: TABLE_FIELDS, IBGroup: ibs }));
  const [latest = [], ...older] = ibGroups;
  const olderIbs = older.flat();

  const lookup = new Map();
  latest.forEach((ib) => {
    const previousByArch = new Map();
    (ib.tests_archs || []).forEach((arch) => {
      const match = olderIbs.find(
        (candidate) => candidate.release_queue === ib.release_queue && hasFinishedResult(candidate, arch)
      );
      if (match) previousByArch.set(arch, { ib: match, isPreviousIb: older[0].includes(match) });
    });
    if (previousByArch.size > 0) lookup.set(ib, previousByArch);
  });
  return lookup;
}
