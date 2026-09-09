import React, { useEffect, useMemo, useState } from "react";
import { Collapse, Form } from "react-bootstrap";
import { FaSearch } from "react-icons/fa";
import { useReactTable, getCoreRowModel, getPaginationRowModel } from "@tanstack/react-table";
import { renderInline } from "./shiftMarkdown";
import { theme, TONE } from "./theme";

// Matches one "[category] [cmssw PR #12345](https://.../pull/12345) (merged)" mention
// from the backend's PR/Issue evidence cell (see server/api_server.py's
// _workflow_evidence_cells) - lets each mention render as its own clickable, colored
// badge instead of one flat, unlinked sentence where a merged PR, an open Issue, and a
// closed PR all read identically.
const EVIDENCE_MENTION_RE = /(?:\[([^\]]+)\]\s*)?\[cmssw\s+(PR|Issue)\s+#(\d+)\]\(([^)]+)\)\s+\(([^)]+)\)/g;

// merged -> success (a real fix likely already landed); open -> warning (still live,
// worth a look); anything else (closed-without-merge, unknown) -> neutral, since a
// closed-unmerged PR/Issue carries much weaker signal than either of those two.
function evidenceStateTone(state) {
  const normalized = (state || "").toLowerCase();
  if (normalized === "merged") return TONE.success;
  if (normalized === "open") return TONE.warning;
  return TONE.neutral;
}

const EvidenceBadge = ({ category, kind, number, url, state }) => {
  const tone = evidenceStateTone(state);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={category ? `${category} — ${state} — opens on GitHub` : `${state} — opens on GitHub`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: "0.76rem",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        color: tone.fg,
        background: tone.tint,
        border: `1px solid ${tone.ring}`,
        marginRight: 6,
        marginBottom: 4,
        whiteSpace: "nowrap",
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      {kind} #{number}
      <span style={{ opacity: 0.75, fontWeight: 500, textTransform: "capitalize" }}>{state}</span>
    </a>
  );
};

// Splits a PR/Issue evidence cell into per-mention badges plus the trailing
// "relevance only, do not prove ..." caveat as a small muted caption. Falls back to
// plain renderInline for anything that doesn't match the expected mention shape (e.g.
// the "No PR/Issue in the imported graph..." message).
function renderPrIssueEvidence(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const mentions = [...trimmed.matchAll(EVIDENCE_MENTION_RE)];
  if (mentions.length === 0) return renderInline(trimmed);
  const caveatIdx = trimmed.indexOf(" -- ");
  const caveat = caveatIdx !== -1 ? trimmed.slice(caveatIdx + 4) : null;
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {mentions.map((match, idx) => (
          <EvidenceBadge key={idx} category={match[1]} kind={match[2]} number={match[3]} url={match[4]} state={match[5]} />
        ))}
      </div>
      {caveat && <div style={{ color: theme.textMuted, fontSize: "0.76rem", marginTop: 2 }}>{caveat}</div>}
    </div>
  );
}

// Columns the shifter needs at a glance. Anything else the backend sends (recurrence,
// PR evidence, stored-failure detail, ...) is treated as drill-down evidence and hidden
// behind a per-row "Show evidence" toggle instead of always-open prose.
const PRIMARY_COLUMNS = ["workflow", "name", "errors", "exit code", "variant", "warnings", "status"];
const MONOSPACE_COLUMNS = ["workflow", "exit code"];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const SEARCH_THRESHOLD = 8;

function isNumericColumn(rows, colIndex) {
  const values = rows.map((row) => (row[colIndex] || "").trim()).filter((value) => value !== "");
  if (values.length === 0) return false;
  return values.every((value) => /^-?\d+(\.\d+)?$/.test(value));
}

// "62720 (SIGSEGV)" -> the numeric code plus a colored label chip, so a shifter scanning
// the column sees the crash-type pattern (a wall of red SIGSEGV chips vs one outlier)
// instead of having to read every parenthetical.
function renderExitCode(value) {
  const match = /^(-?\d+)\s*\(([^)]+)\)\s*$/.exec((value || "").trim());
  if (!match) return renderInline(value);
  const [, code, label] = match;
  const severe = /sig|segv|abort|core|crash/i.test(label);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontFamily: theme.mono }}>{code}</span>
      <span
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          padding: "1px 7px",
          borderRadius: 999,
          whiteSpace: "nowrap",
          background: severe ? "rgba(239, 68, 68, 0.14)" : "rgba(148, 163, 184, 0.12)",
          color: severe ? "#f87171" : theme.textSecondary,
          border: `1px solid ${severe ? "rgba(239, 68, 68, 0.4)" : theme.border}`,
        }}
      >
        {label}
      </span>
    </span>
  );
}

function rowMatchesSearch(row, searchableIndexes, searchLower) {
  if (!searchLower) return true;
  const haystack = searchableIndexes.map((idx) => row[idx] || "").join(" ").toLowerCase();
  return haystack.includes(searchLower);
}

const buttonStyle = {
  border: `1px solid ${theme.border}`,
  background: "transparent",
  color: theme.textSecondary,
  borderRadius: 6,
  padding: "3px 9px",
  fontSize: "0.8rem",
  cursor: "pointer",
  marginRight: 4,
};

// Mirrors RelValComponents/ResultTableWithSteps.js's own Pagination component (same
// controls, same @tanstack/react-table state shape), re-themed dark for this console.
const Pagination = ({ table, totalRows }) => {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const [pageInput, setPageInput] = useState(String(pageIndex + 1));

  useEffect(() => setPageInput(String(pageIndex + 1)), [pageIndex]);

  const commitPageInput = () => {
    const numeric = Number(pageInput);
    if (!Number.isFinite(numeric)) {
      setPageInput(String(pageIndex + 1));
      return;
    }
    const safePage = Math.max(1, Math.min(pageCount, Math.trunc(numeric)));
    setPageInput(String(safePage));
    table.setPageIndex(safePage - 1);
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10,
        padding: "10px 12px",
        background: "rgba(148, 163, 184, 0.05)",
        borderTop: `1px solid ${theme.border}`,
        fontSize: "0.82rem",
        color: theme.textSecondary,
      }}
    >
      <div>
        <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} style={buttonStyle}>
          {"«"}
        </button>
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} style={buttonStyle}>
          {"‹"}
        </button>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} style={buttonStyle}>
          {"›"}
        </button>
        <button onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()} style={buttonStyle}>
          {"»"}
        </button>
        <span style={{ marginLeft: 6 }}>
          Page <strong style={{ color: theme.text }}>{pageIndex + 1}</strong> of{" "}
          <strong style={{ color: theme.text }}>{pageCount}</strong> · {totalRows} rows
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span>
          Go to{" "}
          <input
            type="number"
            min="1"
            max={pageCount}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={commitPageInput}
            onKeyDown={(e) => e.key === "Enter" && commitPageInput()}
            style={{
              width: 56,
              padding: "3px 6px",
              borderRadius: 6,
              border: `1px solid ${theme.border}`,
              background: theme.page,
              color: theme.text,
            }}
          />
        </span>
        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          style={{ padding: "3px 6px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.page, color: theme.text }}
        >
          {PAGE_SIZE_OPTIONS.map((ps) => (
            <option key={ps} value={ps}>
              Show {ps}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

const WorkflowTable = ({ header, rows }) => {
  const [expandedRows, setExpandedRows] = useState({});
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const normalizedHeader = header.map((h) => h.toLowerCase());
  const primaryIndexes = [];
  const evidenceIndexes = [];
  normalizedHeader.forEach((h, idx) => {
    (PRIMARY_COLUMNS.includes(h) ? primaryIndexes : evidenceIndexes).push(idx);
  });

  const searchableIndexes = useMemo(
    () => ["workflow", "name"].map((c) => normalizedHeader.indexOf(c)).filter((i) => i !== -1),
    [normalizedHeader]
  );
  const searchLower = search.trim().toLowerCase();
  const filteredRows = useMemo(
    () => rows.filter((row) => rowMatchesSearch(row, searchableIndexes, searchLower)),
    [rows, searchableIndexes, searchLower]
  );

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [searchLower]);

  // Only used for react-table's row-model bookkeeping (pagination) - cells are still
  // rendered by hand below from `header`/row arrays, same as before this rework.
  const columns = useMemo(() => header.map((_, idx) => ({ id: String(idx), accessorFn: (row) => row[idx] })), [header]);

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });

  const toggleRow = (rowIdx) => setExpandedRows((prev) => ({ ...prev, [rowIdx]: !prev[rowIdx] }));
  const pageRows = table.getRowModel().rows;
  const showSearch = rows.length > SEARCH_THRESHOLD;
  const showPagination = table.getPageCount() > 1;

  return (
    <div>
      {showSearch && (
        <div style={{ position: "relative", maxWidth: 280, marginBottom: 10 }}>
          <FaSearch size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: theme.textMuted }} />
          <Form.Control
            size="sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflow or name…"
            style={{ paddingLeft: 28, background: theme.page, color: theme.text, border: `1px solid ${theme.border}` }}
          />
        </div>
      )}

      <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
          <thead>
            <tr>
              {primaryIndexes.map((idx) => (
                <th
                  key={idx}
                  style={{
                    textAlign: isNumericColumn(rows, idx) ? "right" : "left",
                    padding: "8px 12px",
                    background: "rgba(148, 163, 184, 0.06)",
                    borderBottom: `1px solid ${theme.border}`,
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: theme.textMuted,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {header[idx]}
                </th>
              ))}
              {evidenceIndexes.length > 0 && (
                <th style={{ width: 44, background: "rgba(148, 163, 184, 0.06)", borderBottom: `1px solid ${theme.border}` }} />
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={primaryIndexes.length + 1} style={{ padding: "16px 12px", color: theme.textMuted, fontStyle: "italic" }}>
                  No workflows match "{search}".
                </td>
              </tr>
            )}
            {pageRows.map((tableRow) => {
              const rowIdx = tableRow.index;
              const row = tableRow.original;
              const hasEvidence = evidenceIndexes.some((idx) => (row[idx] || "").trim() !== "");
              const isOpen = !!expandedRows[rowIdx];
              const rowBorder = isOpen ? "none" : `1px solid ${theme.border}`;

              return (
                <React.Fragment key={rowIdx}>
                  <tr>
                    {primaryIndexes.map((idx) => {
                      const isMono = MONOSPACE_COLUMNS.includes(normalizedHeader[idx]);
                      const numeric = isNumericColumn(rows, idx);
                      const isName = normalizedHeader[idx] === "name";
                      return (
                        <td
                          key={idx}
                          title={isName ? row[idx] : undefined}
                          style={{
                            padding: "8px 12px",
                            textAlign: numeric ? "right" : "left",
                            fontFamily: isMono ? theme.mono : undefined,
                            color: theme.text,
                            verticalAlign: "top",
                            borderBottom: rowBorder,
                            ...(isName
                              ? { maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
                              : null),
                          }}
                        >
                          {normalizedHeader[idx] === "exit code" ? renderExitCode(row[idx]) : renderInline(row[idx])}
                        </td>
                      );
                    })}
                    {evidenceIndexes.length > 0 && (
                      <td style={{ padding: "6px 8px", textAlign: "center", borderBottom: rowBorder }}>
                        {hasEvidence && (
                          <button
                            type="button"
                            onClick={() => toggleRow(rowIdx)}
                            style={{
                              border: `1px solid ${isOpen ? theme.primary : theme.border}`,
                              background: isOpen ? "rgba(59, 130, 246, 0.16)" : "transparent",
                              color: "#60a5fa",
                              borderRadius: 999,
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              padding: "3px 10px",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isOpen ? "Hide evidence" : "Show evidence"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>

                  {hasEvidence && (
                    <tr>
                      <td colSpan={primaryIndexes.length + 1} style={{ padding: 0, border: "none" }}>
                        <Collapse in={isOpen}>
                          <div>
                            <div
                              style={{
                                background: "rgba(148, 163, 184, 0.05)",
                                borderBottom: `1px solid ${theme.border}`,
                                padding: "10px 12px 12px 12px",
                                display: "grid",
                                gridTemplateColumns: "max-content 1fr",
                                columnGap: 12,
                                rowGap: 4,
                                fontSize: "0.8rem",
                              }}
                            >
                              {evidenceIndexes.map((idx) =>
                                row[idx]?.trim() ? (
                                  <React.Fragment key={idx}>
                                    <div style={{ color: theme.textMuted, fontWeight: 600 }}>{header[idx]}</div>
                                    <div style={{ color: theme.textSecondary }}>
                                      {normalizedHeader[idx] === "pr/issue evidence"
                                        ? renderPrIssueEvidence(row[idx])
                                        : renderInline(row[idx])}
                                    </div>
                                  </React.Fragment>
                                ) : null
                              )}
                            </div>
                          </div>
                        </Collapse>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

        {showPagination && <Pagination table={table} totalRows={filteredRows.length} />}
      </div>
    </div>
  );
};

export default WorkflowTable;
