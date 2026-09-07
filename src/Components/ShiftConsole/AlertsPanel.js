import React, { useState } from "react";
import { Collapse } from "react-bootstrap";
import { BsBell, BsCheckCircle, BsChevronRight } from "react-icons/bs";
import { FaCode, FaHammer, FaProjectDiagram, FaPuzzlePiece, FaVial } from "react-icons/fa";
import { renderInline } from "./shiftMarkdown";
import { theme, TONE, CATEGORY } from "./theme";
import PanelState from "./PanelState";

// Same category -> icon mapping as DigestPanel's GROUP_META, so an alert card shows the
// same visual language as the digest section it was synthesized from. Alerts with no
// category (the backend's own /api/alerts/status rules, which predate this grouping)
// fall back to a plain bell - still distinguishable from the categorized ones, and never
// mistaken for a wrong category.
const CATEGORY_ICON = { relval: FaProjectDiagram, utests: FaVial, builds: FaHammer, addons: FaPuzzlePiece, clang: FaCode };

// One item in an alert's detail list - collapsed to just the workflow/warning name so a
// card with a dozen items stays scannable, with the errors/exit code/etc. detail (built
// by digestStats.js's tableRowSummary) tucked behind a click instead of always-on, same
// pattern as WorkflowTable.js's per-row "Show evidence" toggle.
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

const AlertCard = ({ alert }) => {
  const CategoryIcon = CATEGORY_ICON[alert.category] || BsBell;
  const categoryColor = CATEGORY[alert.category]?.fg || theme.textMuted;

  return (
    <div
      style={{
        background: TONE.danger.tint,
        border: `1px solid ${TONE.danger.ring}`,
        borderLeft: "4px solid #ef4444",
        borderRadius: 10,
        padding: "12px 16px",
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontWeight: 700,
            fontSize: "0.78rem",
            color: TONE.danger.fg,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          <CategoryIcon size={12} color={categoryColor} />
          {alert.rule?.name || "Alert"}
        </span>
        {typeof alert.evidence?.count === "number" && (
          <span style={{ fontFamily: theme.mono, fontWeight: 700, color: TONE.danger.fg, fontSize: "0.85rem" }}>
            {alert.evidence.count}
          </span>
        )}
      </div>
      <div style={{ color: theme.textSecondary, fontSize: "0.9rem" }}>{renderInline(alert.message)}</div>
      {alert.details?.length > 0 && (
        <ul style={{ margin: "8px 0 0", padding: 0 }}>
          {alert.details.map((item, idx) => (
            <AlertDetailItem key={idx} item={item} />
          ))}
          {alert.moreCount > 0 && (
            <li style={{ color: theme.textMuted, fontSize: "0.82rem", fontStyle: "italic", listStyle: "none", paddingLeft: 15 }}>
              +{alert.moreCount} more — see the Shift digest below
            </li>
          )}
        </ul>
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
        <AlertCard key={alert.rule?.rule_id || idx} alert={alert} />
      ))}
    </div>
  );
};

export default AlertsPanel;
