import React, { useState } from "react";
import { Collapse } from "react-bootstrap";
import { BsBell, BsCheckCircle, BsChevronRight } from "react-icons/bs";
import { FaCode, FaCubes, FaLayerGroup, FaPlus, FaVial } from "react-icons/fa";
import { renderInline } from "./shiftMarkdown";
import { theme, TONE, CATEGORY } from "./theme";
import PanelState from "./PanelState";
import { EvidenceBadge, EvidenceSummaryBadge } from "./prIssueEvidence";

// Same category -> icon mapping as DigestPanel's GROUP_META, and the same icons as the
// main IB Dashboard's own "Row Icons" legend (Navigation.js) - Builds/Unit/RelVal/AddOn/
// Q-A read as the same visual language everywhere in the app, not a separate icon set
// invented for this panel. Clang has no equivalent in that legend (it isn't one of the
// five build-matrix columns), so it keeps its own icon.
const CATEGORY_ICON = { relval: FaLayerGroup, utests: FaVial, builds: FaCubes, addons: FaPlus, clang: FaCode };

// Human-readable row title per category, standing in for the raw section heading
// ("Newly failing RelVal") - the affected architectures are shown separately (as chips, see
// alert.archLabels), so the title itself only needs to say what kind of problem this is.
const CATEGORY_TITLE = {
  relval: "RelVal failure",
  utests: "Unit test failures",
  builds: "Build failure",
  addons: "AddOn failure",
  clang: "Clang warning increase",
};

// Per-field label color for an item's detail line (digestStats.js's tableRowSummary
// detailFields) - "Name: X · Errors: Y · Exit code: Z" used to render as one flat
// muted-gray sentence, which is exactly the fields a shifter most needs to tell apart at a
// glance. Errors/exit code/warnings reuse this app's existing severity colors (TONE) rather
// than inventing new ones, since they already mean "how bad" everywhere else on this page;
// name/status get a couple of distinct, lower-key colors purely for visual separation.
const DETAIL_FIELD_COLOR = {
  name: "#93c5fd", // blue - same convention as theme.js's CODE_CHIP for identifiers
  errors: TONE.danger.fg,
  "exit code": TONE.warning.fg,
  warnings: TONE.warning.fg,
  status: "#2dd4bf", // teal
};

// One item in an alert's detail list - collapsed to just the workflow/warning name so a
// row with a dozen items stays scannable, with the errors/exit code/etc. detail (built by
// digestStats.js's tableRowSummary) tucked behind a click instead of always-on. The one
// exception is `item.prIssue` (a linked PR/Issue, from the same evidence WorkflowTable's
// drawer already shows): a shifter deciding whether a failure is already known needs that
// signal without expanding every row, so it renders as an always-visible badge next to the
// name, with the full clickable mention(s) still available behind the same click as the rest
// of the detail.
const AlertDetailItem = ({ item }) => {
  const [open, setOpen] = useState(false);
  const hasPrIssue = item.prIssue?.length > 0;
  const hasDetail = item.detailFields?.length > 0 || hasPrIssue;

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
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {renderInline(item.name)}
        </span>
        {hasPrIssue && <EvidenceSummaryBadge mentions={item.prIssue} />}
      </button>
      {hasDetail && (
        <Collapse in={open}>
          <div style={{ paddingLeft: 15, fontSize: "0.8rem", margin: "2px 0 4px" }}>
            {/* Evidence first, error fields after - "is this already known" is the more
                actionable question, so it shouldn't be buried below the raw failure fields. */}
            {hasPrIssue && (
              <div style={{ display: "flex", flexWrap: "wrap", marginBottom: item.detailFields?.length ? 4 : 0 }}>
                {item.prIssue.map((m, idx) => (
                  <EvidenceBadge key={idx} category={m.category} kind={m.kind} number={m.number} url={m.url} state={m.state} />
                ))}
              </div>
            )}
            {item.detailFields?.length > 0 && (
              <div style={{ color: theme.textMuted }}>
                {item.detailFields.map(({ field, label, value }, idx) => (
                  <React.Fragment key={field}>
                    {idx > 0 && " · "}
                    <span style={{ color: DETAIL_FIELD_COLOR[field] || theme.textMuted, fontWeight: 700 }}>{label}:</span>{" "}
                    {renderInline(value)}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </Collapse>
      )}
    </li>
  );
};

// One card in the Recent Problems feed - a left severity bar, subtle danger-tinted
// background and a bold count pill are the same "this is an alert, not a table row"
// language Grafana/PagerDuty/GitHub Actions use, so a shifter scanning the page catches
// these before anything else on it. Category icon badge + message/release-cycle subtitle +
// architecture chips, chevron - clicking the card expands into one workflow-level detail
// list per architecture beneath it. One card per category (not per architecture) - a RelVal
// failure spanning two architectures is one card with two chips and two drill-down groups,
// not two separate cards. No timestamp column - the comparison alerts synthesized from a
// digest carry no per-event time, only what fired and its evidence. No per-row window label
// either - every row in this list is always the same comparison, named once above the list
// itself (the release cycle chip is a short "which cycle" hint, not the full window).
const AlertRow = ({ alert }) => {
  const [open, setOpen] = useState(false);
  const CategoryIcon = CATEGORY_ICON[alert.category] || BsBell;
  const categoryColor = CATEGORY[alert.category]?.fg || theme.textMuted;
  const title = CATEGORY_TITLE[alert.category] || alert.rule?.name || "Alert";
  const hasDetails = (alert.evidence?.count ?? 0) > 0;
  const count = alert.evidence?.count ?? null;

  return (
    <div
      style={{
        position: "relative",
        marginBottom: 10,
        background: "rgba(239, 68, 68, 0.06)",
        border: `1px solid ${TONE.danger.ring}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: TONE.danger.fg }} />
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
          padding: "12px 14px 12px 18px",
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
            border: `1px solid ${TONE.danger.ring}`,
          }}
        >
          <CategoryIcon size={15} color={categoryColor} />
        </span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div style={{ fontWeight: 800, fontSize: "0.92rem", color: TONE.danger.fg }}>{title}</div>
          <div
            title={[alert.message, alert.releaseCycle].filter(Boolean).join(" · ")}
            style={{
              color: theme.textMuted,
              fontSize: "0.8rem",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {renderInline(alert.message)}
            {alert.releaseCycle && " · "}
            {alert.releaseCycle && <span style={{ fontFamily: theme.mono }}>{alert.releaseCycle}</span>}
          </div>
          {/* Every affected architecture as its own chip, in one card, instead of the old
              per-architecture cards or a collapsed "N architectures" count - a shifter should
              see at a glance which architectures this category is failing on without expanding. */}
          {alert.archLabels?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
              {alert.archLabels.map((archLabel) => (
                <span
                  key={archLabel}
                  style={{
                    fontFamily: theme.mono,
                    fontSize: "0.72rem",
                    color: theme.textSecondary,
                    background: "rgba(148, 163, 184, 0.1)",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 999,
                    padding: "1px 8px",
                  }}
                >
                  {archLabel}
                </span>
              ))}
            </div>
          )}
        </span>
        {count != null && (
          <span
            style={{
              minWidth: 30,
              height: 30,
              padding: "0 8px",
              flexShrink: 0,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: TONE.danger.tint,
              border: `1px solid ${TONE.danger.ring}`,
              color: TONE.danger.fg,
              fontWeight: 800,
              fontSize: "0.92rem",
            }}
          >
            {count}
          </span>
        )}
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
          <div style={{ padding: "0 14px 12px 58px" }}>
            {alert.archGroups.map((group) => (
              <div key={group.archLabel} style={{ marginBottom: 8 }}>
                {alert.archGroups.length > 1 && (
                  <div
                    style={{
                      fontFamily: theme.mono,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: theme.textSecondary,
                      margin: "4px 0 2px",
                    }}
                  >
                    {group.archLabel}
                  </div>
                )}
                <ul style={{ margin: 0, padding: 0 }}>
                  {group.items.map((item, idx) => (
                    <AlertDetailItem key={idx} item={item} />
                  ))}
                  {group.moreCount > 0 && (
                    <li style={{ color: theme.textMuted, fontSize: "0.82rem", fontStyle: "italic", listStyle: "none" }}>
                      +{group.moreCount} more — see the Shift digest below
                    </li>
                  )}
                </ul>
              </div>
            ))}
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
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: TONE.success.fg,
          background: TONE.success.tint,
          border: `1px solid ${TONE.success.ring}`,
          borderRadius: 10,
          padding: "14px 16px 14px 20px",
          fontSize: "0.9rem",
          fontWeight: 500,
          overflow: "hidden",
        }}
      >
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: TONE.success.fg }} />
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
