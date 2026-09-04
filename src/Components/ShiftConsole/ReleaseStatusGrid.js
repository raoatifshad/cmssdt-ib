import React from "react";
import { FaCheck, FaCubes, FaLayerGroup, FaPlus, FaTimes, FaVial } from "react-icons/fa";
import { FaClipboardList } from "react-icons/fa";
import { theme } from "./theme";
import { categoryFailingTotal, summarizeArchCell } from "./releaseExplorerData";
import StatusSphere from "./StatusSphere";

// Same five categories, same row icons, as IBPageComponents/ComparisonTable.js's
// rowLabelConfig - a shifter who knows the main dashboard recognizes this instantly.
const CATEGORIES = [
  { key: "builds", label: "Builds", icon: <FaCubes size={12} /> },
  { key: "utests", label: "Unit", icon: <FaVial size={12} /> },
  { key: "relvals", label: "RelVal", icon: <FaLayerGroup size={12} /> },
  { key: "addons", label: "AddOn", icon: <FaPlus size={12} /> },
  { key: "dupDict", label: "Q/A", icon: <FaClipboardList size={12} /> },
];

const cellIcon = (status) => {
  if (status === "success") return <FaCheck size={11} />;
  if (status === "danger") return <FaTimes size={11} />;
  return null;
};

const thStyle = {
  padding: "8px 10px",
  background: "rgba(148, 163, 184, 0.06)",
  borderBottom: `1px solid ${theme.border}`,
  fontSize: "0.68rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: theme.textMuted,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const TotalsStrip = ({ comparison }) => (
  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
    {CATEGORIES.map((c) => {
      const total = categoryFailingTotal(comparison, c.key);
      return (
        <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem" }}>
          <span style={{ color: theme.textMuted }}>{c.icon}</span>
          <span style={{ color: theme.textMuted, fontWeight: 600 }}>{c.label}</span>
          <span style={{ fontWeight: 800, color: total > 0 ? "#f87171" : "#4ade80" }}>{total}</span>
        </div>
      );
    })}
  </div>
);

const ReleaseStatusGrid = ({ comparison }) => {
  const archs = comparison.tests_archs || [];

  return (
    <div>
      <TotalsStrip comparison={comparison} />
      <div style={{ overflowX: "auto", border: `1px solid ${theme.border}`, borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left" }}>Architecture</th>
              {CATEGORIES.map((c) => (
                <th key={c.key} style={{ ...thStyle, textAlign: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {c.icon}
                    {c.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {archs.map((arch) => (
              <tr key={arch}>
                <td style={{ padding: "8px 12px", fontFamily: theme.mono, fontWeight: 700, color: theme.text, borderBottom: `1px solid ${theme.border}` }}>
                  {arch}
                </td>
                {CATEGORIES.map((c) => {
                  const cell = summarizeArchCell(comparison, c.key, arch);
                  return (
                    <td key={c.key} style={{ padding: "8px 12px", textAlign: "center", borderBottom: `1px solid ${theme.border}` }}>
                      <StatusSphere status={cell.status} value={cell.value} icon={cellIcon(cell.status)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReleaseStatusGrid;
