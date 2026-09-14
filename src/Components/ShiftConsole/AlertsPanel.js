import React, { useState } from "react";
import { Collapse } from "react-bootstrap";
import { BsBell, BsCheckCircle, BsChevronRight } from "react-icons/bs";
import { FaCode, FaCubes, FaLayerGroup, FaPlus, FaVial } from "react-icons/fa";
import { renderInline } from "./shiftMarkdown";
import { theme, TONE, CATEGORY } from "./theme";
import PanelState from "./PanelState";

// Same category -> icon mapping as DigestPanel's GROUP_META, and the same icons as the
// main IB Dashboard's own "Row Icons" legend (Navigation.js) - Builds/Unit/RelVal/AddOn/
// Q-A read as the same visual language everywhere in the app, not a separate icon set
// invented for this panel. Alerts with no category (the backend's own /api/alerts/status
// rules, which predate this grouping) fall back to a plain bell - still distinguishable
// from the categorized ones, and never mistaken for a wrong category. Clang has no
// equivalent in that legend (it isn't one of the five build-matrix columns), so it keeps
// its own icon.
const CATEGORY_ICON = { relval: FaLayerGroup, utests: FaVial, builds: FaCubes, addons: FaPlus, clang: FaCode };

// Human-readable row title per category, standing in for the raw section heading
// ("Newly failing RelVal") - the architecture is shown separately (alert.archLabel), so
// the title itself only needs to say what kind of problem this is.
const CATEGORY_TITLE = {
  relval: "RelVal failure",
  utests: "Unit test failures",
  builds: "Build failure",
  addons: "AddOn failure",
  clang: "Clang warning increase",
};

// One item in an alert's detail list - collapsed to just the workflow/warning name so a
// row with a dozen items stays scannable, with the errors/exit code/etc. detail (built by
// digestStats.js's tableRowSummary) tucked behind a click instead of always-on.
const AlertDetailItem = ({ item }) => {
  const [open, setOpen] = useState(false);
  const hasDetail = !!item.detail;

  return (
    <li style={{ listStyle: "none" }}>
      <button
        type="button"
        onClick={() => hasDetail && setOpen((prev) => !prev)}
        disabled={!hasDetail}
        style={{
          all: "unset",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "2px 0",
          cursor: hasDetail ? "pointer" : "default",
          color: theme.textSecondary,
          fontSize: "0.84rem",
        }}
      >
        {hasDetail ? (
          <BsChevronRight
            size={9}
            color={theme.textMuted}
            style={{ flexShrink: 0, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.1s" }}
          />
        ) : (
          <span style={{ width: 9, flexShrink: 0 }} />
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{renderInline(item.name)}</span>
      </button>
      {hasDetail && (
        <Collapse in={open}>
          <div style={{ paddingLeft: 15, color: theme.textMuted, fontSize: "0.8rem", margin: "2px 0 4px" }}>
            {renderInline(item.detail)}
          </div>
        </Collapse>
      )}
    </li>
  );
};

// One row in the Recent Problems feed: icon badge, category title + arch/message
// subtitle, chevron - clicking the row expands the workflow-level detail list beneath it.
// No timestamp column - neither the backend's real-time rules nor the comparison alerts
// synthesized from a digest carry a per-event time, only what fired and its evidence.
const AlertRow = ({ alert }) => {
  const [open, setOpen] = useState(false);
  const CategoryIcon = CATEGORY_ICON[alert.category] || BsBell;
  const categoryColor = CATEGORY[alert.category]?.fg || theme.textMuted;
  const title = CATEGORY_TITLE[alert.category] || alert.rule?.name || "Alert";
  const hasDetails = alert.details?.length > 0;

  return (
    <div style={{ borderBottom: `1px solid ${theme.border}` }}>
      <button
        type="button"
        onClick={() => hasDetails && setOpen((prev) => !prev)}
        style={{
          all: "unset",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          padding: "12px 4px",
          cursor: hasDetails ? "pointer" : "default",
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: TONE.danger.tint,
          }}
        >
          <CategoryIcon size={15} color={categoryColor} />
        </span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: TONE.danger.fg }}>{title}</div>
          <div
            title={[alert.archLabel, alert.windowLabel, alert.message].filter(Boolean).join(" · ")}
            style={{
              color: theme.textMuted,
              fontSize: "0.8rem",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {alert.archLabel && <span style={{ fontFamily: theme.mono }}>{alert.archLabel}</span>}
            {alert.archLabel && " · "}
            {/* Which two builds actually produced this row - backend regression alerts
                always diff "latest vs previous" globally, digest-comparison alerts diff
                whatever window is currently loaded on the Shift digest tab, and those two
                can legitimately be different builds at the same moment. Without this, two
                alert rows sitting next to each other in the same list could silently refer
                to different comparisons with no way to tell which is which. */}
            {alert.windowLabel && <span style={{ fontFamily: theme.mono }}>{alert.windowLabel}</span>}
            {alert.windowLabel && " · "}
            {renderInline(alert.message)}
          </div>
        </span>
        {hasDetails && (
          <BsChevronRight
            size={13}
            color={theme.textMuted}
            style={{ flexShrink: 0, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
          />
        )}
      </button>
      {hasDetails && (
        <Collapse in={open}>
          <div style={{ padding: "0 4px 12px 58px" }}>
            <ul style={{ margin: 0, padding: 0 }}>
              {alert.details.map((item, idx) => (
                <AlertDetailItem key={idx} item={item} />
              ))}
              {alert.moreCount > 0 && (
                <li style={{ color: theme.textMuted, fontSize: "0.82rem", fontStyle: "italic", listStyle: "none" }}>
                  +{alert.moreCount} more — see the Shift digest below
                </li>
              )}
            </ul>
          </div>
        </Collapse>
      )}
    </div>
  );
};

const AlertsPanel = ({ alerts, loading, error, onRetry }) => {
  if (loading) return <PanelState kind="loading" text="Checking alerts…" />;
  if (error) return <PanelState kind="error" text="Couldn't load alert status." onRetry={onRetry} />;

  if (!alerts || alerts.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: TONE.success.fg,
          background: TONE.success.tint,
          border: `1px solid ${TONE.success.ring}`,
          borderRadius: 10,
          padding: "14px 16px",
          fontSize: "0.9rem",
          fontWeight: 500,
        }}
      >
        <BsCheckCircle size={16} />
        No alerts currently firing
      </div>
    );
  }

  return (
    <div>
      {alerts.map((alert, idx) => (
        <AlertRow key={alert.rule?.rule_id || idx} alert={alert} />
      ))}
    </div>
  );
};

export default AlertsPanel;
