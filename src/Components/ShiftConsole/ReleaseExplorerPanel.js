import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "react-bootstrap";
import { BsArrowRight, BsX } from "react-icons/bs";
import { getDisplayName } from "../../Utils/processing";
import { theme } from "./theme";
import { buildTrendSeries, buildsBetween, fetchFlavorData, fetchStructure, listDatedBuilds } from "./releaseExplorerData";
import SearchableSelect from "./SearchableSelect";
import ReleaseStatusGrid from "./ReleaseStatusGrid";
import TrendChart from "./TrendChart";
import PanelState from "./PanelState";

const TREND_SERIES = [
  { key: "builds", label: "Builds", color: "#94a3b8" },
  { key: "utests", label: "Unit", color: "#fbbf24" },
  { key: "relvals", label: "RelVal", color: "#f87171" },
  { key: "addons", label: "AddOn", color: "#60a5fa" },
  { key: "dupDict", label: "Q/A", color: "#c084fc" },
];

// Owns one side's picker state (cycle -> flavor -> dated build) plus the flavor JSON it
// needs, sharing `flavorCache`/`loadFlavor` across both sides of a compare so picking the
// same flavor twice doesn't refetch it.
function useReleaseSelection(structure, loadFlavor, flavorCache) {
  const [sel, setSel] = useState({ cycle: "", flavor: "", date: "" });

  useEffect(() => {
    if (!structure || sel.cycle) return;
    const initialCycle = structure.default_release || structure.all_prefixes?.[structure.all_prefixes.length - 1] || "";
    setSel((s) => ({ ...s, cycle: initialCycle }));
  }, [structure, sel.cycle]);

  const flavorOptions = useMemo(() => (structure && sel.cycle ? structure[sel.cycle] || [] : []), [structure, sel.cycle]);

  useEffect(() => {
    if (!flavorOptions.length) return;
    if (!flavorOptions.includes(sel.flavor)) {
      setSel((s) => ({ ...s, flavor: flavorOptions[0], date: "" }));
    }
  }, [flavorOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sel.flavor) loadFlavor(sel.flavor);
  }, [sel.flavor, loadFlavor]);

  const flavorData = sel.flavor ? flavorCache[sel.flavor] : null;
  const datedBuilds = useMemo(() => (flavorData ? listDatedBuilds(flavorData) : []), [flavorData]);

  useEffect(() => {
    if (!datedBuilds.length) return;
    if (!datedBuilds.find((b) => b.release_name === sel.date)) {
      setSel((s) => ({ ...s, date: datedBuilds[0].release_name }));
    }
  }, [datedBuilds]); // eslint-disable-line react-hooks/exhaustive-deps

  const comparison = datedBuilds.find((b) => b.release_name === sel.date) || null;

  return {
    sel,
    setCycle: (cycle) => setSel({ cycle, flavor: "", date: "" }),
    setFlavor: (flavor) => setSel((s) => ({ ...s, flavor, date: "" })),
    setDate: (date) => setSel((s) => ({ ...s, date })),
    flavorOptions,
    datedBuilds,
    comparison,
    flavorLoading: sel.flavor ? flavorCache[sel.flavor] === undefined : false,
  };
}

const ReleaseColumn = ({ title, structure, selection, onRemove }) => {
  const cycleOptions = useMemo(
    () => (structure.all_prefixes || []).slice().reverse().map((p) => ({ value: p, label: p })),
    [structure]
  );
  const flavorOptions = selection.flavorOptions.map((f) => ({ value: f, label: getDisplayName(f), mono: false }));
  const dateOptions = selection.datedBuilds.map((b) => ({ value: b.release_name, label: b.release_name, mono: true }));

  return (
    <div style={{ flex: "1 1 380px", minWidth: 320 }}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: theme.textMuted }}>
          {title}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            style={{ border: "none", background: "transparent", color: theme.textMuted, cursor: "pointer", display: "flex" }}
            title="Remove comparison"
          >
            <BsX size={18} />
          </button>
        )}
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <SearchableSelect label="Release cycle" value={selection.sel.cycle} options={cycleOptions} onChange={selection.setCycle} />
        <SearchableSelect
          label="Flavor / sub-build"
          value={selection.sel.flavor}
          options={flavorOptions}
          onChange={selection.setFlavor}
          disabled={!flavorOptions.length}
        />
        <SearchableSelect
          label="Dated build"
          value={selection.sel.date}
          options={dateOptions}
          onChange={selection.setDate}
          disabled={!dateOptions.length}
        />
      </div>

      {selection.sel.flavor && (
        <div style={{ marginBottom: 10 }}>
          <Link
            to={`/ib/${selection.sel.cycle}`}
            style={{ fontSize: "0.78rem", color: "#60a5fa", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            Open full dashboard for this cycle <BsArrowRight size={11} />
          </Link>
        </div>
      )}

      {selection.flavorLoading && <PanelState kind="loading" text="Loading release data…" />}
      {!selection.flavorLoading && selection.comparison && <ReleaseStatusGrid comparison={selection.comparison} />}
      {!selection.flavorLoading && selection.sel.flavor && !selection.comparison && (
        <PanelState kind="empty" text="No completed builds found for this flavor." />
      )}
    </div>
  );
};

// Shares selectionA's cycle/flavor (and therefore its fetched builds) rather than owning
// a separate pair of pickers - "which release cycle" is one decision, "single build vs a
// range of them" is a different one layered on top of it.
const TrendPanel = ({ structure, selection }) => {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (!selection.datedBuilds.length) return;
    if (!selection.datedBuilds.find((b) => b.release_name === fromDate)) {
      setFromDate(selection.datedBuilds[selection.datedBuilds.length - 1].release_name);
    }
    if (!selection.datedBuilds.find((b) => b.release_name === toDate)) {
      setToDate(selection.datedBuilds[0].release_name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.datedBuilds]);

  const cycleOptions = useMemo(
    () => (structure.all_prefixes || []).slice().reverse().map((p) => ({ value: p, label: p })),
    [structure]
  );
  const flavorOptions = selection.flavorOptions.map((f) => ({ value: f, label: getDisplayName(f) }));
  const dateOptions = selection.datedBuilds.map((b) => ({ value: b.release_name, label: b.release_name, mono: true }));

  const builds = useMemo(() => buildsBetween(selection.datedBuilds, fromDate, toDate), [selection.datedBuilds, fromDate, toDate]);
  const points = useMemo(() => buildTrendSeries(builds), [builds]);

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <SearchableSelect label="Release cycle" value={selection.sel.cycle} options={cycleOptions} onChange={selection.setCycle} />
        <SearchableSelect
          label="Flavor / sub-build"
          value={selection.sel.flavor}
          options={flavorOptions}
          onChange={selection.setFlavor}
          disabled={!flavorOptions.length}
        />
        <SearchableSelect label="From build" value={fromDate} options={dateOptions} onChange={setFromDate} disabled={!dateOptions.length} />
        <SearchableSelect label="To build" value={toDate} options={dateOptions} onChange={setToDate} disabled={!dateOptions.length} />
      </div>

      {selection.flavorLoading && <PanelState kind="loading" text="Loading release data…" />}
      {!selection.flavorLoading && points.length > 0 && (
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: "0.8rem", color: theme.textMuted, marginBottom: 12 }}>
            Failing count per category across {points.length} build{points.length === 1 ? "" : "s"}
            {points.length > 1 && (
              <>
                , {points[0].label} → {points[points.length - 1].label}
              </>
            )}
          </div>
          <TrendChart points={points} series={TREND_SERIES} />
        </div>
      )}
      {!selection.flavorLoading && points.length === 0 && selection.sel.flavor && (
        <PanelState kind="empty" text="No completed builds found in this range." />
      )}
    </div>
  );
};

const MODE_OPTIONS = [
  { key: "single", label: "Single build" },
  { key: "compare", label: "Compare two" },
  { key: "trend", label: "Trend over range" },
];

const ModeSwitcher = ({ mode, onChange }) => (
  <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
    {MODE_OPTIONS.map((m) => {
      const active = m.key === mode;
      return (
        <button
          key={m.key}
          type="button"
          onClick={() => onChange(m.key)}
          style={{
            border: `1px solid ${active ? theme.primary : theme.border}`,
            background: active ? "rgba(59, 130, 246, 0.16)" : "transparent",
            color: active ? "#93c5fd" : theme.textSecondary,
            borderRadius: 999,
            padding: "5px 14px",
            fontSize: "0.78rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {m.label}
        </button>
      );
    })}
  </div>
);

const ReleaseExplorerPanel = () => {
  const [structure, setStructure] = useState(null);
  const [error, setError] = useState(false);
  const [flavorCache, setFlavorCache] = useState({});
  const [mode, setMode] = useState("single");
  const inFlight = React.useRef(new Set());

  useEffect(() => {
    fetchStructure()
      .then(setStructure)
      .catch(() => setError(true));
  }, []);

  const loadFlavor = useCallback((flavorName) => {
    if (inFlight.current.has(flavorName)) return;
    inFlight.current.add(flavorName);
    fetchFlavorData(flavorName)
      .then((data) => setFlavorCache((c) => ({ ...c, [flavorName]: data })))
      .catch(() => setFlavorCache((c) => ({ ...c, [flavorName]: null })))
      .finally(() => inFlight.current.delete(flavorName));
  }, []);

  const selectionA = useReleaseSelection(structure, loadFlavor, flavorCache);
  const selectionB = useReleaseSelection(mode === "compare" ? structure : null, loadFlavor, flavorCache);

  if (error) return <PanelState kind="error" text="Couldn't load release structure data." />;
  if (!structure) return <PanelState kind="loading" text="Loading release list…" />;

  return (
    <div>
      <ModeSwitcher mode={mode} onChange={setMode} />

      {mode !== "trend" && (
        <div className="d-flex flex-wrap gap-4">
          <ReleaseColumn title="Release A" structure={structure} selection={selectionA} />
          {mode === "compare" && <ReleaseColumn title="Release B" structure={structure} selection={selectionB} onRemove={() => setMode("single")} />}
        </div>
      )}

      {mode === "single" && (
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => setMode("compare")}
          style={{ borderColor: theme.border, color: theme.textSecondary, marginTop: 4 }}
        >
          + Compare to another release
        </Button>
      )}

      {mode === "trend" && <TrendPanel structure={structure} selection={selectionA} />}
    </div>
  );
};

export default ReleaseExplorerPanel;
