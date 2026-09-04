import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Spinner } from "react-bootstrap";
import { BsArrowRepeat, BsArrowRight, BsBoxArrowRight, BsChevronLeft } from "react-icons/bs";
import { FaClipboardList } from "react-icons/fa";
import { fetchShiftJson, fetchShiftSummaryWindows, isShiftLoginAvailable } from "./shiftApi";
import { buildDigestDocument } from "./shiftMarkdown";
import { aggregateStats, buildComparisonAlerts } from "./digestStats";
import { theme, CARD } from "./theme";
import AlertsPanel from "./AlertsPanel";
import DigestPanel from "./DigestPanel";
import ShiftScoreboard from "./ShiftScoreboard";
import ReleaseExplorerPanel from "./ReleaseExplorerPanel";
import SearchableSelect from "./SearchableSelect";

const sectionHeading = {
  fontSize: "0.95rem",
  fontWeight: 700,
  color: theme.text,
  margin: 0,
};

// "Shift summary: CMSSW_20_1_X_2026-08-19-1100 -> CMSSW_20_1_X_2026-08-19-2300"
// -> { label: "Shift summary", from: "CMSSW_...", to: "CMSSW_..." }
function parseDigestWindow(title) {
  const match = /^(.*?):\s*(\S+)\s*(?:->|→)\s*(\S+)\s*$/.exec(title || "");
  if (!match) return null;
  return { label: match[1].trim(), from: match[2].trim(), to: match[3].trim() };
}

// "CMSSW_20_1_X_2026-08-19-2300" -> "CMSSW_20_1_X" - different release cycles build on the
// same schedule, so /api/shift-summary/windows can return several cycles sharing one
// timestamp. Only one cycle's windows make sense to pick between at a time.
function releaseCycle(releaseName) {
  const match = /^(.*)_\d{4}-\d{2}-\d{2}-\d{4}$/.exec(releaseName || "");
  return match ? match[1] : null;
}

// A slow breathing dot next to the refresh timestamp - the "this view is live" signal
// ops dashboards (Grafana, Datadog) use so a shifter trusts the data without re-reading it.
const LivePulse = () => (
  <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8, marginRight: 2 }}>
    <style>{`
      @keyframes shift-console-pulse {
        0% { transform: scale(0.9); opacity: 0.9; }
        70% { transform: scale(2.2); opacity: 0; }
        100% { transform: scale(2.2); opacity: 0; }
      }
    `}</style>
    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#4ade80", animation: "shift-console-pulse 2s ease-out infinite" }} />
    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#4ade80" }} />
  </span>
);

const FullPageMessage = ({ title, text, children }) => (
  <div style={{ background: theme.page, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
    <div
      style={{
        maxWidth: 440,
        textAlign: "center",
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 14,
        padding: "32px 28px",
      }}
    >
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: theme.text, marginBottom: 8 }}>{title}</h2>
      <p style={{ color: theme.textMuted, fontSize: "0.92rem", margin: 0 }}>{text}</p>
      {children}
    </div>
  </div>
);

// Dev-only bypass for local testing without real CERN SSO client credentials
// (backend: GET /shift/dev-login?username=...). Gated on import.meta.env.DEV so it
// can never render in a production build.
const DevLoginForm = () => {
  const [username, setUsername] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    window.location.href = `/shift/dev-login?username=${encodeURIComponent(trimmed)}`;
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 20 }}>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="CERN username"
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: "0.85rem",
            width: 160,
            background: theme.page,
            color: theme.text,
          }}
        />
        <Button type="submit" size="sm" variant="primary">
          Dev sign-in
        </Button>
      </div>
      <div style={{ color: theme.textMuted, fontSize: "0.72rem", marginTop: 8 }}>
        Local-only bypass - not available in production builds.
      </div>
    </form>
  );
};

const selectStyle = {
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: "0.85rem",
  color: theme.textSecondary,
  background: theme.page,
};

const ShiftConsolePage = () => {
  const navigate = useNavigate();

  const [access, setAccess] = useState({ status: "checking", username: null });
  const [summary, setSummary] = useState({ markdown: "", loading: true, error: false, loadedAt: null });
  const [alerts, setAlerts] = useState({ items: [], loading: true, error: false });
  const [arch, setArch] = useState("");
  const [windows, setWindows] = useState({ items: [], loading: true, error: false });
  // Both empty = "current" (default backend window). A custom window is only requested
  // once both sides are picked, so we never send a lone from/to and hit the backend's 422.
  const [range, setRange] = useState({ from: "", to: "" });

  // 403 can appear on any request, not just at login - the allowlist is re-checked every
  // time. Every fetch below routes its failure through this so it's handled the same way
  // no matter which panel triggered it.
  const handleAuthError = useCallback((err) => {
    if (err?.kind === "unauthorized") {
      // This backend returns 401 from the API even when SSO is completely unconfigured -
      // only /shift/login itself reveals that. Check before navigating so an unconfigured
      // deployment shows our own message instead of a raw backend error page.
      isShiftLoginAvailable().then((available) => {
        if (available) {
          window.location.href = "/shift/login";
        } else {
          setAccess({ status: "unavailable", username: null });
        }
      });
      return true;
    }
    if (err?.kind === "forbidden") {
      setAccess({ status: "forbidden", username: null });
      return true;
    }
    if (err?.kind === "unavailable") {
      setAccess({ status: "unavailable", username: null });
      return true;
    }
    return false;
  }, []);

  const loadSummary = useCallback(
    (archValue, rangeValue) => {
      setSummary((prev) => ({ ...prev, loading: true, error: false }));
      const params = new URLSearchParams();
      if (archValue) params.set("arch", archValue);
      // from/to are the release_name values from /api/shift-summary/windows - only ever
      // sent as a pair, since the backend 422s on a lone from or to.
      if (rangeValue?.from && rangeValue?.to) {
        params.set("from", rangeValue.from);
        params.set("to", rangeValue.to);
      }
      const qs = params.toString() ? `?${params.toString()}` : "";
      fetchShiftJson(`/api/shift-summary${qs}`)
        .then((data) => {
          setSummary({ markdown: data.markdown || "", loading: false, error: false, loadedAt: new Date() });
        })
        .catch((err) => {
          if (handleAuthError(err)) return;
          setSummary((prev) => ({ ...prev, loading: false, error: true }));
        });
    },
    [handleAuthError]
  );

  const loadWindows = useCallback(() => {
    setWindows((prev) => ({ ...prev, loading: true, error: false }));
    fetchShiftSummaryWindows()
      .then((data) => setWindows({ items: data.windows || [], loading: false, error: false }))
      .catch((err) => {
        if (handleAuthError(err)) return;
        setWindows((prev) => ({ ...prev, loading: false, error: true }));
      });
  }, [handleAuthError]);

  const loadAlerts = useCallback(() => {
    setAlerts((prev) => ({ ...prev, loading: true, error: false }));
    fetchShiftJson("/api/alerts/status")
      .then((data) => {
        setAlerts({ items: data.alerts || [], loading: false, error: false });
      })
      .catch((err) => {
        if (handleAuthError(err)) return;
        setAlerts((prev) => ({ ...prev, loading: false, error: true }));
      });
  }, [handleAuthError]);

  useEffect(() => {
    fetchShiftJson("/api/shift-whoami")
      .then((data) => setAccess({ status: "ok", username: data.username }))
      .catch((err) => {
        if (!handleAuthError(err)) setAccess({ status: "error", username: null });
      });
  }, [handleAuthError]);

  useEffect(() => {
    if (access.status !== "ok") return;
    loadSummary("");
    loadAlerts();
    loadWindows();
    // Only re-run when access is (re)confirmed - arch/range changes have their own handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.status]);

  const handleRefresh = () => {
    loadSummary(arch, range);
    loadAlerts();
  };

  const handleArchChange = (value) => {
    setArch(value);
    loadSummary(value, range);
  };

  // Only fires once both sides hold a value - a lone from or to gets the backend's 422.
  const handleRangeChange = (part, value) => {
    const next = { ...range, [part]: value };
    setRange(next);
    if (next.from && next.to) {
      loadSummary(arch, next);
    }
  };

  const digestDoc = useMemo(() => buildDigestDocument(summary.markdown), [summary.markdown]);
  const archOptions = useMemo(() => digestDoc.archs.map((a) => a.name.replace(/`/g, "")), [digestDoc]);
  const digestWindow = useMemo(() => parseDigestWindow(digestDoc.title), [digestDoc]);
  const scoreboardStats = useMemo(() => aggregateStats(digestDoc.archs), [digestDoc]);
  // Errors the currently-displayed digest itself surfaces (default live window, or a
  // custom from/to comparison) - folded into the Alerts panel alongside the backend's
  // real-time rules below, since the backend has no notion of a shifter-picked comparison.
  const comparisonAlerts = useMemo(() => buildComparisonAlerts(digestDoc.archs), [digestDoc]);
  const combinedAlerts = useMemo(() => [...comparisonAlerts, ...alerts.items], [comparisonAlerts, alerts.items]);

  // Scope the picker to the digest's own release cycle - without this, windows from every
  // cycle (e.g. CMSSW_20_1_X and CMSSW_16_1_X both building at 11:00) show up side by side
  // and look like duplicates, and picking across cycles wouldn't be a meaningful window.
  const currentCycle = useMemo(
    () => releaseCycle(digestWindow?.to) || releaseCycle(digestWindow?.from),
    [digestWindow]
  );

  const windowOptions = useMemo(() => {
    const items = currentCycle ? windows.items.filter((w) => releaseCycle(w.release_name) === currentCycle) : windows.items;
    return items.map((w) => ({ value: w.release_name, label: w.release_name, mono: true }));
  }, [windows.items, currentCycle]);

  // Keeps the two dropdowns in sync with whatever window the digest currently on screen
  // actually covers - after the initial parameterless load, after a refresh, and after an
  // explicit from/to pick all land here the same way, via the parsed digest title.
  useEffect(() => {
    if (!digestWindow) return;
    setRange((prev) => (prev.from === digestWindow.from && prev.to === digestWindow.to ? prev : { from: digestWindow.from, to: digestWindow.to }));
  }, [digestWindow]);

  if (access.status === "checking") {
    return (
      <FullPageMessage title="Checking access…" text="Confirming your CERN session.">
        <div style={{ marginTop: 16 }}>
          <Spinner animation="border" size="sm" style={{ color: theme.primary }} />
        </div>
      </FullPageMessage>
    );
  }

  if (access.status === "forbidden") {
    return (
      <FullPageMessage
        title="Not authorized"
        text="This CERN account isn't on the shift console allowlist. Ask a shift console administrator to add you."
      />
    );
  }

  if (access.status === "unavailable") {
    return (
      <FullPageMessage
        title="Sign-in isn't set up yet"
        text="CERN SSO isn't configured for the shift console on this deployment yet."
      >
        {import.meta.env.DEV && <DevLoginForm />}
      </FullPageMessage>
    );
  }

  if (access.status === "error") {
    return <FullPageMessage title="Something went wrong" text="Couldn't reach the shift console backend." />;
  }

  return (
    <div style={{ background: theme.page, minHeight: "100vh", paddingTop: 24, paddingBottom: 60 }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 20px" }}>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => navigate("/")}
          className="d-flex align-items-center gap-1 mb-3"
          style={{ border: `1px solid ${theme.border}`, color: theme.textSecondary, background: "transparent", width: "fit-content" }}
        >
          <BsChevronLeft size={12} /> Back to IB Dashboard
        </Button>

        <div style={{ ...CARD, marginBottom: 20 }}>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  background: `linear-gradient(135deg, ${theme.primaryStrong} 0%, ${theme.primary} 100%)`,
                }}
              >
                <FaClipboardList size={19} />
              </div>
              <div>
                <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: theme.text, margin: 0 }}>Shift Console</h1>
                <div style={{ display: "flex", alignItems: "center", color: theme.textMuted, fontSize: "0.85rem", marginTop: 2 }}>
                  {!summary.loading && <LivePulse />}
                  Signed in as <strong style={{ color: theme.textSecondary, margin: "0 4px" }}>{access.username}</strong>
                  {summary.loadedAt && <> · Last refreshed {summary.loadedAt.toLocaleTimeString()}</>}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {archOptions.length > 0 && (
                <select value={arch} onChange={(e) => handleArchChange(e.target.value)} style={selectStyle}>
                  <option value="">All architectures</option>
                  {archOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              )}

              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleRefresh}
                className="d-flex align-items-center gap-2"
                style={{ borderColor: theme.border, color: theme.textSecondary }}
              >
                <BsArrowRepeat /> Refresh
              </Button>
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => {
                  window.location.href = "/shift/logout";
                }}
                className="d-flex align-items-center gap-2"
              >
                <BsBoxArrowRight /> Sign out
              </Button>
            </div>
          </div>

          {digestWindow && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: `1px solid ${theme.border}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: theme.textMuted,
                }}
              >
                {digestWindow.label}
              </span>
              <SearchableSelect
                value={range.from}
                options={windowOptions}
                onChange={(value) => handleRangeChange("from", value)}
                disabled={windows.loading || windows.error}
                minWidth={340}
              />
              <BsArrowRight color={theme.textMuted} size={13} />
              <SearchableSelect
                value={range.to}
                options={windowOptions}
                onChange={(value) => handleRangeChange("to", value)}
                disabled={windows.loading || windows.error}
                minWidth={340}
              />
              {windows.error && (
                <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>Couldn't load past shift windows.</span>
              )}
            </div>
          )}
        </div>

        <section style={{ ...CARD, marginBottom: 20 }}>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h2 style={sectionHeading}>Alerts</h2>
            {!alerts.loading && !alerts.error && (
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: "3px 10px",
                  color: combinedAlerts.length ? "#f87171" : "#4ade80",
                  background: combinedAlerts.length ? "rgba(239, 68, 68, 0.14)" : "rgba(34, 197, 94, 0.14)",
                  border: `1px solid ${combinedAlerts.length ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.35)"}`,
                }}
              >
                {combinedAlerts.length ? `${combinedAlerts.length} firing` : "All clear"}
              </span>
            )}
          </div>
          <AlertsPanel alerts={combinedAlerts} loading={alerts.loading} error={alerts.error} onRetry={loadAlerts} />
        </section>

        {!summary.loading && !summary.error && digestDoc.archs.length > 0 && (
          <ShiftScoreboard
            archCount={digestDoc.archs.length}
            stats={scoreboardStats}
            alertsCount={combinedAlerts.length}
            alertsLoading={alerts.loading}
          />
        )}

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ ...sectionHeading, marginBottom: 12 }}>Shift digest</h2>
          <DigestPanel markdown={summary.markdown} loading={summary.loading} error={summary.error} onRetry={() => loadSummary(arch, range)} />
        </section>

        <section>
          <h2 style={{ ...sectionHeading, marginBottom: 4 }}>Release Explorer</h2>
          <div style={{ color: theme.textMuted, fontSize: "0.82rem", marginBottom: 14 }}>
            Pick any release cycle, flavor, and dated build to see its full Builds / Unit / RelVal / AddOn / Q-A
            status - independent of the live shift window above. Add a second release to compare.
          </div>
          <ReleaseExplorerPanel />
        </section>
      </div>
    </div>
  );
};

export default ShiftConsolePage;
