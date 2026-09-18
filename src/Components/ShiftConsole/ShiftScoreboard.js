import React, { useMemo, useState } from "react";
import { BsChevronRight, BsCheckCircle, BsCpu, BsExclamationTriangle } from "react-icons/bs";
import { FaCubes, FaVial } from "react-icons/fa";
import { archStats, categoryItemsByArch } from "./digestStats";
import { renderInline } from "./shiftMarkdown";
import { theme, TONE } from "./theme";

// Grafana-style stat tile: big number, a left edge bar in the threshold color so the
// state reads peripherally without focusing on the number, and an icon chip that reuses
// the same tone as the edge bar. Every tile is independently clickable - each one expands
// only the breakdown relevant to *that* number (e.g. "Build failures" shows Build items,
// not RelVal/Unit Tests/Clang too), not one shared table repeated for every tile.
const Tile = ({ icon, value, label, tone, onClick, expanded }) => {
  const t = TONE[tone];
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 14,
        padding: "16px 18px 16px 22px",
        flex: "1 1 170px",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: t.fg, opacity: tone === "neutral" ? 0.35 : 0.9 }} />
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: t.tint,
          color: t.fg,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "1.55rem", fontWeight: 800, color: theme.text, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "0.76rem", color: theme.textMuted, marginTop: 4, fontWeight: 600 }}>{label}</div>
      </div>
      {onClick && (
        <BsChevronRight
          size={13}
          color={theme.textMuted}
          style={{ marginLeft: "auto", flexShrink: 0, transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
        />
      )}
    </div>
  );
};

const thStyle = {
  textAlign: "left",
  padding: "8px 12px",
  color: theme.textMuted,
  fontWeight: 700,
  fontSize: "0.68rem",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  whiteSpace: "nowrap",
};

const tdStyle = { padding: "8px 12px", fontSize: "0.82rem", whiteSpace: "nowrap" };

// Same per-arch fields archStats() already computes (digestStats.js), just laid out as
// columns instead of summed into one page-wide total - only ever shown for the
// "Architectures checked" tile, since that one legitimately stands for every category at
// once. Every other tile drills into just its own category's actual item names instead
// (see CategoryItemList) - a count-only column here was the thing the user flagged as not
// useful once they'd already clicked into one specific stat.
const BREAKDOWN_COLUMNS = [
  { key: "relval", label: "RelVal", newKey: "newFailing", resolvedKey: "resolved" },
  { key: "builds", label: "Builds", newKey: "newFailingBuilds", resolvedKey: "resolvedBuilds" },
  { key: "utests", label: "Unit Tests", newKey: "newFailingUtests", resolvedKey: "resolvedUtests" },
  { key: "addons", label: "AddOn", newKey: "newFailingAddons", resolvedKey: "resolvedAddons" },
  { key: "clang", label: "Clang", newKey: "newWarnings", resolvedKey: "resolvedWarnings" },
];

const CountCell = ({ n, r }) => (
  <span>
    <span style={{ color: n ? TONE.danger.fg : theme.textMuted, fontWeight: n ? 700 : 400 }}>{n}</span>
    <span style={{ color: theme.textMuted }}> new</span>
    {r > 0 && <span style={{ color: TONE.success.fg }}> · {r} resolved</span>}
  </span>
);

const ArchBreakdownTable = ({ archBreakdown }) => (
  <div style={{ marginTop: 10, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: theme.page }}>
          <th style={thStyle}>Architecture</th>
          {BREAKDOWN_COLUMNS.map((c) => (
            <th key={c.key} style={thStyle}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {archBreakdown.map((row) => (
          <tr key={row.name} style={{ borderTop: `1px solid ${theme.border}` }}>
            <td style={{ ...tdStyle, fontFamily: theme.mono, color: theme.textSecondary }}>{row.name}</td>
            {BREAKDOWN_COLUMNS.map((c) => (
              <td key={c.key} style={tdStyle}>
                <CountCell n={row.stats[c.newKey]} r={row.stats[c.resolvedKey]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Which category+side a given stat tile (other than "Architectures checked") drills into -
// see digestStats.js's categoryItemsByArch. "Newly failing workflows" and "Resolved
// workflows" share the "relval" category, one on each side.
const TILE_CATEGORY = {
  relvalNew: { category: "relval", side: "new" },
  relvalResolved: { category: "relval", side: "resolved" },
  builds: { category: "builds", side: "new" },
  utests: { category: "utests", side: "new" },
  clang: { category: "clang", side: "new" },
};

// The actual workflow/build/test names for one stat tile, grouped by architecture - what a
// shifter actually wants after clicking "1 newly failing workflow": which workflow, not
// just the number restated per arch.
const CategoryItemList = ({ groups }) => (
  <div style={{ marginTop: 10, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "hidden" }}>
    {groups.length === 0 ? (
      <div style={{ padding: "14px 16px", color: theme.textMuted, fontSize: "0.85rem" }}>
        Nothing in this category for the current comparison.
      </div>
    ) : (
      groups.map((group, idx) => (
        <div key={group.name} style={{ padding: "10px 14px", borderTop: idx === 0 ? "none" : `1px solid ${theme.border}` }}>
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: "0.72rem",
              color: theme.textMuted,
              fontWeight: 700,
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {group.name}
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {group.items.map((item, i) => (
              <li key={i} style={{ fontSize: "0.85rem", color: theme.textSecondary }}>
                {renderInline(item.name)}
                {item.detail && (
                  <div style={{ color: theme.textMuted, fontSize: "0.78rem", marginTop: 1 }}>{renderInline(item.detail)}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))
    )}
  </div>
);

const ShiftScoreboard = ({ archCount, stats, windowLabel, archs }) => {
  const [expandedTile, setExpandedTile] = useState(null);
  const toggle = (tile) => setExpandedTile((prev) => (prev === tile ? null : tile));

  const archBreakdown = useMemo(
    () => (archs || []).map((a) => ({ name: a.name.replace(/`/g, ""), stats: archStats(a) })),
    [archs]
  );

  const tileCategory = expandedTile && TILE_CATEGORY[expandedTile];
  const categoryGroups = useMemo(
    () => (tileCategory ? categoryItemsByArch(archs, tileCategory.category, tileCategory.side) : []),
    [archs, tileCategory]
  );

  return (
    <div style={{ marginBottom: 20 }}>
      {windowLabel && (
        <div
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: theme.textMuted,
            marginBottom: 8,
          }}
        >
          Comparing: {windowLabel}
        </div>
      )}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Tile
          icon={<BsCpu size={18} />}
          value={archCount}
          label="Architectures checked"
          tone="neutral"
          onClick={() => toggle("archs")}
          expanded={expandedTile === "archs"}
        />
        <Tile
          icon={<BsExclamationTriangle size={17} />}
          value={stats.newFailing}
          label="Newly failing workflows"
          tone={stats.newFailing ? "danger" : "success"}
          onClick={() => toggle("relvalNew")}
          expanded={expandedTile === "relvalNew"}
        />
        <Tile
          icon={<BsCheckCircle size={17} />}
          value={stats.resolved}
          label="Resolved workflows"
          tone="success"
          onClick={() => toggle("relvalResolved")}
          expanded={expandedTile === "relvalResolved"}
        />
        <Tile
          icon={<FaCubes size={16} />}
          value={stats.newFailingBuilds}
          label="Build failures"
          tone={stats.newFailingBuilds ? "danger" : "success"}
          onClick={() => toggle("builds")}
          expanded={expandedTile === "builds"}
        />
        <Tile
          icon={<FaVial size={16} />}
          value={stats.newFailingUtests}
          label="Unit test failures"
          tone={stats.newFailingUtests ? "danger" : "success"}
          onClick={() => toggle("utests")}
          expanded={expandedTile === "utests"}
        />
        <Tile
          icon={<BsExclamationTriangle size={17} />}
          value={stats.newWarnings}
          label="New Clang warnings"
          tone={stats.newWarnings ? "warning" : "success"}
          onClick={() => toggle("clang")}
          expanded={expandedTile === "clang"}
        />
      </div>
      {expandedTile === "archs" && archBreakdown.length > 0 && <ArchBreakdownTable archBreakdown={archBreakdown} />}
      {tileCategory && <CategoryItemList groups={categoryGroups} />}
    </div>
  );
};

export default ShiftScoreboard;
