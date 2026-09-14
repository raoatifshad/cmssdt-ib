import React, { useEffect, useMemo, useState } from "react";
import { Collapse, Form } from "react-bootstrap";
import { FaSearch } from "react-icons/fa";
import { useReactTable, getCoreRowModel, getPaginationRowModel } from "@tanstack/react-table";
import { renderInline } from "./shiftMarkdown";
import { theme, TONE, TINT_COLORS, TINT_SWATCH_COLORS } from "./theme";

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
const PRIMARY_COLUMNS = ["workflow", "name", "errors", "exit code", "architecture", "variant", "warnings", "status", "in a", "in b"];
const MONOSPACE_COLUMNS = ["workflow", "exit code", "architecture"];
// "In A"/"In B" (CompareFailuresPanel's merged table) always read as small centered dots,
// never as text/numeric-aligned cells - a single-letter header would otherwise be enough
// to trip isNumericColumn's own "every value looks numeric" check on an empty result set.
const DOT_COLUMNS = ["in a", "in b"];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const SEARCH_THRESHOLD = 8;

// `light` (WorkflowTable's own prop, default false/dark): CompareFailuresPanel and
// TestFailuresPanel render this table on a white card instead of this app's usual dark
// navy surface, at the user's request - a dense, color-coded comparison table read better
// with dark text on white than light text on a tinted dark row. Every hardcoded color in
// this file used to assume "light text on dark" (the app's one and only theme until now),
// so each one needs its own light-mode counterpart here rather than just swapping a
// couple of background colors - text, borders, chips, all of it.
const PALETTE = {
  dark: {
    cardBg: "transparent",
    border: theme.border,
    headerBg: "rgba(148, 163, 184, 0.06)",
    headerText: theme.textMuted,
    cellText: theme.text,
    mutedText: theme.textMuted,
    secondaryText: theme.textSecondary,
    zebra: "rgba(148, 163, 184, 0.035)",
    inputBg: theme.page,
    exitSevereBg: "rgba(239, 68, 68, 0.14)",
    exitSevereFg: "#f87171",
    exitSevereBorder: "rgba(239, 68, 68, 0.4)",
    exitNormalBg: "rgba(148, 163, 184, 0.12)",
    exitNormalFg: theme.textSecondary,
    exitNormalBorder: theme.border,
    evidenceBg: "rgba(148, 163, 184, 0.05)",
    evidenceBtnBg: "rgba(59, 130, 246, 0.16)",
  },
  light: {
    cardBg: "#ffffff",
    border: "#e2e8f0",
    headerBg: "#f8fafc",
    headerText: "#64748b",
    cellText: "#0f172a",
    mutedText: "#64748b",
    secondaryText: "#334155",
    zebra: "rgba(15, 23, 42, 0.028)",
    inputBg: "#ffffff",
    exitSevereBg: "rgba(220, 38, 38, 0.09)",
    exitSevereFg: "#b91c1c",
    exitSevereBorder: "rgba(220, 38, 38, 0.3)",
    exitNormalBg: "#f1f5f9",
    exitNormalFg: "#475569",
    exitNormalBorder: "#e2e8f0",
    evidenceBg: "#f8fafc",
    evidenceBtnBg: "rgba(59, 130, 246, 0.12)",
  },
};

function isNumericColumn(rows, colIndex) {
  const values = rows.map((row) => (row[colIndex] || "").trim()).filter((value) => value !== "");
  if (values.length === 0) return false;
  return values.every((value) => /^-?\d+(\.\d+)?$/.test(value));
}

// "62720 (SIGSEGV)" -> the numeric code plus a colored label chip, so a shifter scanning
// the column sees the crash-type pattern (a wall of red SIGSEGV chips vs one outlier)
// instead of having to read every parenthetical.
function renderExitCode(value, palette) {
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
          background: severe ? palette.exitSevereBg : palette.exitNormalBg,
          color: severe ? palette.exitSevereFg : palette.exitNormalFg,
          border: `1px solid ${severe ? palette.exitSevereBorder : palette.exitNormalBorder}`,
        }}
      >
        {label}
      </span>
    </span>
  );
}

// "dot:both"/"dot:onlyA"/"dot:onlyB" -> a small filled circle in that exact TINT_SWATCH_
// COLORS hue (the same colors CompareFailuresPanel's Legend uses, imported not duplicated
// so the two can never drift apart); "dot:empty" -> a faint hollow ring, meaning "not
// failing in this release". This is CompareFailuresPanel's "In A"/"In B" columns' entire
// design: two small dots replace the old wide "Both"/"Only A" text column *and* the old
// whole-row background tint in one move - one signal instead of two competing ones, and
// unlike a tinted row, a hollow-vs-filled dot pair reads correctly without relying on
// color perception alone (shape changes too, not just color).
function renderDot(value) {
  const match = /^dot:(\w+)$/.exec(value || "");
  if (!match) return null;
  const key = match[1];
  if (key === "empty") {
    return <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", border: "1.5px solid #cbd5e1" }} />;
  }
  return <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: TINT_SWATCH_COLORS[key] || "#94a3b8" }} />;
}

function rowMatchesSearch(row, searchableIndexes, searchLower) {
  if (!searchLower) return true;
  const haystack = searchableIndexes.map((idx) => row[idx] || "").join(" ").toLowerCase();
  return haystack.includes(searchLower);
}

// Row background per "tint" value (see theme.js's TINT_COLORS - shared with the legend
// CompareFailuresPanel renders, so the two never drift apart). Plain zebra striping is the
// fallback for every other table (digest tables included) so rows stay scannable without
// needing a semantic tint at all.
function rowBackground(tint, isEvenVisualRow, palette) {
  if (tint && TINT_COLORS[tint]) return TINT_COLORS[tint];
  return isEvenVisualRow ? palette.zebra : "transparent";
}

// Mirrors RelValComponents/ResultTableWithSteps.js's own Pagination component (same
// controls, same @tanstack/react-table state shape), re-themed for this console (dark or,
// per `light`, the white-card variant - see PALETTE).
const Pagination = ({ table, totalRows, palette }) => {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const [pageInput, setPageInput] = useState(String(pageIndex + 1));

  useEffect(() => setPageInput(String(pageIndex + 1)), [pageIndex]);

  const buttonStyle = {
    border: `1px solid ${palette.border}`,
    background: "transparent",
    color: palette.secondaryText,
    borderRadius: 6,
    padding: "3px 9px",
    fontSize: "0.8rem",
    cursor: "pointer",
    marginRight: 4,
  };

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
        background: palette.evidenceBg,
        borderTop: `1px solid ${palette.border}`,
        fontSize: "0.82rem",
        color: palette.secondaryText,
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
          Page <strong style={{ color: palette.cellText }}>{pageIndex + 1}</strong> of{" "}
          <strong style={{ color: palette.cellText }}>{pageCount}</strong> · {totalRows} rows
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
              border: `1px solid ${palette.border}`,
              background: palette.inputBg,
              color: palette.cellText,
            }}
          />
        </span>
        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          style={{ padding: "3px 6px", borderRadius: 6, border: `1px solid ${palette.border}`, background: palette.inputBg, color: palette.cellText }}
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

// `columnLabels`: {normalized-header -> display text} - lets a caller show a real value
// (e.g. a specific release's short build label) as the header text while `header` itself
// keeps using the canonical name ("in a"/"in b", "exit code", ...) that this component's
// own column-type detection (PRIMARY_COLUMNS, DOT_COLUMNS, MONOSPACE_COLUMNS, the search
// index) matches against. Without this indirection, renaming a header to make it more
// specific would silently break that column's special rendering/behavior.
const WorkflowTable = ({ header, rows, light = false, columnLabels = {} }) => {
  const palette = light ? PALETTE.light : PALETTE.dark;
  const [expandedRows, setExpandedRows] = useState({});
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const normalizedHeader = header.map((h) => h.toLowerCase());
  // "tint" is a hidden column, never rendered as its own <td> - a caller (TestFailuresPanel's
  // Compare mode) can append one "shared"/"unique"/"" value per row to color that row's
  // background instead of spelling the comparison out as prose in a visible cell. Excluded
  // from both primary and evidence indexes below so it never shows up as a real column.
  const tintIndex = normalizedHeader.indexOf("tint");
  // "highlight" is the same kind of hidden column as "tint" - a caller (ReleaseStatusGrid,
  // via TestFailuresPanel) sets it per-row to ring-highlight the rows matching whichever
  // architecture is currently hovered in the status grid above, layered on top of whatever
  // tint/zebra background that row already has rather than replacing it.
  const highlightIndex = normalizedHeader.indexOf("highlight");
  const primaryIndexes = [];
  const evidenceIndexes = [];
  normalizedHeader.forEach((h, idx) => {
    if (idx === tintIndex || idx === highlightIndex) return;
    (PRIMARY_COLUMNS.includes(h) ? primaryIndexes : evidenceIndexes).push(idx);
  });

  const searchableIndexes = useMemo(
    () => ["workflow", "name", "architecture"].map((c) => normalizedHeader.indexOf(c)).filter((i) => i !== -1),
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
          <FaSearch size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: palette.mutedText }} />
          <Form.Control
            size="sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflow or name…"
            style={{ paddingLeft: 28, background: palette.inputBg, color: palette.cellText, border: `1px solid ${palette.border}` }}
          />
        </div>
      )}

      <div style={{ border: `1px solid ${palette.border}`, borderRadius: 10, overflow: "hidden", background: palette.cardBg }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
          <thead>
            <tr>
              {primaryIndexes.map((idx) => {
                const customLabel = columnLabels[normalizedHeader[idx]];
                return (
                <th
                  key={idx}
                  style={{
                    textAlign: DOT_COLUMNS.includes(normalizedHeader[idx]) ? "center" : isNumericColumn(rows, idx) ? "right" : "left",
                    padding: "8px 12px",
                    background: palette.headerBg,
                    borderBottom: `1px solid ${palette.border}`,
                    fontSize: "0.72rem",
                    // A full release tag ("CMSSW_20_1_X_2026-09-08-2300") is far too long to
                    // force onto one nowrap line without blowing the column - and unlike this
                    // app's own generic labels, its casing/underscores are a real identifier,
                    // not something textTransform:uppercase should touch. Wrap it across a
                    // couple of lines in a capped-width header instead.
                    ...(customLabel
                      ? { whiteSpace: "normal", wordBreak: "break-word", maxWidth: 120, lineHeight: 1.3 }
                      : { textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }),
                    color: palette.headerText,
                    fontWeight: 700,
                  }}
                >
                  {customLabel ?? header[idx]}
                </th>
                );
              })}
              {evidenceIndexes.length > 0 && (
                <th style={{ width: 44, background: palette.headerBg, borderBottom: `1px solid ${palette.border}` }} />
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={primaryIndexes.length + 1} style={{ padding: "16px 12px", color: palette.mutedText, fontStyle: "italic" }}>
                  No workflows match "{search}".
                </td>
              </tr>
            )}
            {pageRows.map((tableRow, visualIdx) => {
              const rowIdx = tableRow.index;
              const row = tableRow.original;
              const hasEvidence = evidenceIndexes.some((idx) => (row[idx] || "").trim() !== "");
              const isOpen = !!expandedRows[rowIdx];
              const rowBorder = isOpen ? "none" : `1px solid ${palette.border}`;
              const tint = tintIndex !== -1 ? row[tintIndex] || "" : "";
              const background = rowBackground(tint, visualIdx % 2 === 0, palette);
              const highlighted = highlightIndex !== -1 && !!(row[highlightIndex] || "");
              // A hovered circle in the status grid above marks 0+ rows "highlighted" on
              // this page (see `highlightIndex`) - when it's marked any at all, the rest of
              // the page dims/blurs so the matching row(s) actually pop instead of just
              // getting a same-size ring lost among a dozen other rows.
              const highlightActive = highlightIndex !== -1 && pageRows.some((r) => !!(r.original[highlightIndex] || ""));

              return (
                <React.Fragment key={rowIdx}>
                  <tr
                    style={{
                      background,
                      position: "relative",
                      transition: "filter 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease",
                      ...(highlighted
                        ? { zIndex: 3, boxShadow: "0 0 0 2px #ef4444, 0 10px 24px rgba(0, 0, 0, 0.3)" }
                        : highlightActive
                        ? { filter: "blur(1.5px)", opacity: 0.5 }
                        : {}),
                    }}
                  >
                    {primaryIndexes.map((idx) => {
                      const isMono = MONOSPACE_COLUMNS.includes(normalizedHeader[idx]);
                      const isDot = DOT_COLUMNS.includes(normalizedHeader[idx]);
                      const numeric = !isDot && isNumericColumn(rows, idx);
                      const isName = normalizedHeader[idx] === "name";
                      return (
                        <td
                          key={idx}
                          title={isName ? row[idx] : undefined}
                          style={{
                            // "Bigger" for a highlighted row is real padding/font-size, not
                            // a CSS transform: scale() - scaling a <tr> pushes its edges past
                            // its own box, and the table's rounded-corner wrapper clips
                            // anything crossing that boundary (`overflow: hidden`, needed to
                            // keep the corners clean) - found live: a highlighted row's own
                            // leftmost text ("RecoTracker/LSTCore") got its first two
                            // characters clipped clean off. Padding/font-size actually
                            // reflow the layout instead of just visually overdrawing it, so
                            // there's nothing left to clip.
                            padding: highlighted ? "12px 14px" : "8px 12px",
                            fontSize: highlighted ? "0.94rem" : undefined,
                            fontWeight: highlighted ? 600 : undefined,
                            textAlign: isDot ? "center" : numeric ? "right" : "left",
                            fontFamily: isMono ? theme.mono : undefined,
                            color: palette.cellText,
                            verticalAlign: "top",
                            borderBottom: rowBorder,
                            // Every primary column stays one line - a long value (e.g. a
                            // cross-release comparison tag) wrapping across 5+ lines blew up
                            // row height and defeated the point of a compact table. `name`
                            // additionally ellipsizes instead of just clipping, since it's
                            // the one column expected to sometimes overflow its own width.
                            whiteSpace: "nowrap",
                            ...(isName ? { maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis" } : null),
                          }}
                        >
                          {normalizedHeader[idx] === "exit code"
                            ? renderExitCode(row[idx], palette)
                            : isDot
                            ? renderDot(row[idx])
                            : renderInline(row[idx])}
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
                              border: `1px solid ${isOpen ? theme.primary : palette.border}`,
                              background: isOpen ? palette.evidenceBtnBg : "transparent",
                              color: light ? "#2563eb" : "#60a5fa",
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
                                background: palette.evidenceBg,
                                borderBottom: `1px solid ${palette.border}`,
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
                                    <div style={{ color: palette.mutedText, fontWeight: 600 }}>{header[idx]}</div>
                                    <div style={{ color: palette.secondaryText }}>
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

        {showPagination && <Pagination table={table} totalRows={filteredRows.length} palette={palette} />}
      </div>
    </div>
  );
};

export default WorkflowTable;
