// Drop-in location (confirmed from your own repo's convention, per the
// IBLayout.js diff): src/Components/ChatBot/ChatWidget.js
//
// Left-side sliding drawer, full viewport height, with a toggle tab that
// stays attached to the panel's edge (acts as both open and close handle).
// Uses react-bootstrap (already a dependency per CLAUDE.md: "UI is Bootstrap 5
// via react-bootstrap"). NOT verified against the actual repo source — this
// is a first-draft UI built from the documented architecture, not tested
// against real running code (or a real build — no Vite/JSX toolchain in the
// environment this was built in). Expect to adjust styling/imports once
// dropped into the real project; ChatContext.js is the part that's actually
// been tested (against the real backend), this file is the part that needs
// your eyes on it first.
import React, { useState, useRef, useEffect } from "react";
import { Button, Form, Spinner } from "react-bootstrap";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useChat } from "../../context/ChatContext";

const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 600;
const DEFAULT_PANEL_WIDTH = 360;
const CHAT_API_BASE = import.meta.env.VITE_CHAT_API_BASE || "http://localhost:8002";
const CMSSDT_API_BASE = import.meta.env.VITE_CMSSDT_API_BASE;

const CMSSW_TAG_PATTERN = /^CMSSW_\d+_\d+_X_\d{4}-\d{2}-\d{2}-\d{4}$/;
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
}[character]));

const renderMarkdownToHtml = (markdown) => {
  if (!markdown) return "";

  const renderer = new marked.Renderer();
  renderer.html = (rawHtmlFromModel) => escapeHtml(rawHtmlFromModel);
  const rawHtml = marked.parse(markdown, {
    breaks: true,
    gfm: true,
    renderer,
  });

  // Add CSS styling for tables and content spacing
  const styledHtml = `
    <style>
      .chat-message-content table {
        width: max-content;
        min-width: 100%;
        border-collapse: collapse;
        margin: 8px 0;
        font-size: 11px;
      }
      .chat-message-content table thead {
        background-color: #f3f4f6;
      }
      .chat-message-content table th,
      .chat-message-content table td {
        padding: 6px 8px;
        border: 1px solid #d1d5db;
        text-align: left;
      }
      .chat-message-content table th {
        font-weight: 600;
        color: #374151;
      }
      .chat-message-content table tbody tr:nth-child(even) {
        background-color: #fafafa;
      }
      .chat-message-content table tbody tr:hover {
        background-color: #f3f4f6;
      }
      .chat-message-content table td:not(:first-child) {
        text-align: right;
      }
      .chat-message-content p {
        margin: 6px 0;
        line-height: 1.4;
      }
      .chat-message-content ul,
      .chat-message-content ol {
        margin: 6px 0;
        padding-left: 16px;
      }
      .chat-message-content li {
        margin: 3px 0;
        line-height: 1.4;
      }
      .chat-message-content h1,
      .chat-message-content h2,
      .chat-message-content h3 {
        margin: 8px 0 4px 0;
        font-size: inherit;
        font-weight: 600;
      }
      .chat-message-content code {
        background-color: #f3f4f6;
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 10px;
        font-family: monospace;
      }
      .chat-message-content pre {
        background-color: #f3f4f6;
        padding: 6px 8px;
        border-radius: 4px;
        overflow-x: auto;
        font-size: 10px;
        margin: 6px 0;
      }
      .chat-message-content strong,
      .chat-message-content b {
        font-weight: 700;
        color: #1f2937;
      }
      .chat-message-content em,
      .chat-message-content i {
        color: #6366f1;
        font-weight: 500;
      }
      .chat-message-content a {
        color: #0d6efd;
        text-decoration: none;
        font-weight: 500;
      }
      .chat-message-content a:hover {
        text-decoration: underline;
      }
      .chat-message-content {
        overflow-x: auto;
      }
    </style>
  `;

  const sanitized = DOMPurify.sanitize(typeof rawHtml === "string" ? rawHtml : "");
  return styledHtml + sanitized;
};

// Matches a GFM markdown table block (header row + separator row + body rows)
// so a table can be pulled out of a message and rendered as a grouped list
// instead of raw HTML, without disturbing any surrounding prose.
const TABLE_BLOCK_REGEX = /^\|.*\|[ \t]*\r?\n\|[ \t\-:|]+\|[ \t]*\r?\n(?:\|.*\|[ \t]*\r?\n?)*/m;

const splitContentAroundTable = (content) => {
  if (!content) return null;
  const match = content.match(TABLE_BLOCK_REGEX);
  if (!match) return null;
  return {
    intro: content.slice(0, match.index),
    tableMarkdown: match[0],
    outro: content.slice(match.index + match[0].length),
  };
};

// Grouping only helps when the first column repeats (e.g. the same Source IB
// listed once per failing RelVal row) — that's what forces a table with a
// long repeated first column into a narrow chat panel with horizontal
// scroll in the first place. Works for any number of trailing columns.
const isGroupableTable = (headers, rows) => {
  if (headers.length < 2 || rows.length < 2) return false;
  const uniqueFirstColumn = new Set(rows.map((row) => row[0]));
  return uniqueFirstColumn.size > 0 && uniqueFirstColumn.size < rows.length;
};

const buildGroups = (rows) => {
  const groups = [];
  const indexByKey = new Map();
  rows.forEach(([key, ...rest]) => {
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length);
      groups.push({ key, values: [] });
    }
    groups[indexByKey.get(key)].values.push(rest);
  });
  return groups;
};

function GroupedResultTable({ headers, rows }) {
  const remainingHeaders = headers.slice(1);
  const groups = React.useMemo(() => buildGroups(rows), [rows]);
  const [expanded, setExpanded] = useState(() => {
    const allExpanded = groups.length <= 3;
    const initial = {};
    groups.forEach((_, idx) => {
      initial[idx] = allExpanded;
    });
    return initial;
  });

  const toggleGroup = (idx) => setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
  const setAll = (value) => {
    const next = {};
    groups.forEach((_, idx) => {
      next[idx] = value;
    });
    setExpanded(next);
  };

  const linkButtonStyle = {
    background: "none",
    border: "none",
    color: "#0d6efd",
    fontSize: "10px",
    cursor: "pointer",
    padding: 0,
  };

  return (
    <div style={{ margin: "6px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span style={{ fontSize: "10px", color: "#6b7280" }}>
          {rows.length} rows grouped by {headers[0]} ({groups.length} groups)
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" onClick={() => setAll(true)} style={linkButtonStyle}>Expand all</button>
          <button type="button" onClick={() => setAll(false)} style={linkButtonStyle}>Collapse all</button>
        </div>
      </div>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: "6px", overflow: "hidden" }}>
        {groups.map((group, idx) => (
          <div key={`${group.key}-${idx}`} style={{ borderTop: idx === 0 ? "none" : "1px solid #e5e7eb" }}>
            <button
              type="button"
              onClick={() => toggleGroup(idx)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 8px",
                background: "#f9fafb",
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 600,
                color: "#374151",
                textAlign: "left",
              }}
            >
              <span style={{ overflowWrap: "anywhere" }}>{expanded[idx] ? "▼" : "▶"} {group.key}</span>
              <span style={{ background: "#e5e7eb", borderRadius: "10px", padding: "1px 7px", fontSize: "10px", flexShrink: 0, marginLeft: "6px" }}>
                {group.values.length}
              </span>
            </button>
            {expanded[idx] && remainingHeaders.length === 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", padding: "6px 8px", background: "#fff" }}>
                {group.values.map((value, valueIdx) => (
                  <span
                    key={valueIdx}
                    style={{
                      background: "#f3f4f6",
                      border: "1px solid #e5e7eb",
                      borderRadius: "4px",
                      padding: "2px 6px",
                      fontSize: "11px",
                      color: "#111827",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {value[0] || "—"}
                  </span>
                ))}
              </div>
            )}
            {expanded[idx] && remainingHeaders.length > 1 && (
              <div style={{ overflowX: "auto", background: "#fff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                  <thead>
                    <tr style={{ background: "#fafafa" }}>
                      {remainingHeaders.map((header, headerIdx) => (
                        <th
                          key={headerIdx}
                          style={{
                            padding: "4px 6px",
                            borderBottom: "1px solid #e5e7eb",
                            textAlign: headerIdx === 0 ? "left" : "right",
                            color: "#374151",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.values.map((value, valueIdx) => (
                      <tr key={valueIdx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        {value.map((cell, cellIdx) => (
                          <td
                            key={cellIdx}
                            style={{
                              padding: "4px 6px",
                              textAlign: cellIdx === 0 ? "left" : "right",
                              color: "#111827",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {cell || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const renderProfessionalComparison = (content) => {
  if (!content) return renderMarkdownToHtml(content);

  const normalized = String(content).replace(/\r\n/g, "\n");
  const hasComparisonMarkers = /IB comparison|RelVals run|Failed RelVals|Unit tests run/i.test(normalized);

  if (!hasComparisonMarkers) {
    return renderMarkdownToHtml(content);
  }

  const lines = normalized.split("\n").map((line) => line.trim());

  const architectureMatch = normalized.match(/(?:architecture|arch)[:\s]*([A-Za-z0-9_.-]+)/i);
  const architecture = architectureMatch ? architectureMatch[1] : "Comparison";

  const metricLabels = [
    "RelVals run",
    "Failed RelVals",
    "RelVal errors",
    "RelVal warnings",
    "Unit tests run",
    "Failed unit tests",
    "Unit-test errors",
  ];

  const tableRows = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const matchLabel = metricLabels.find((label) => label.toLowerCase() === line.toLowerCase());

    if (matchLabel) {
      const build1 = lines[i + 1];
      const build2 = lines[i + 2];
      const delta = lines[i + 3];

      if (build1 && build2 && delta) {
        tableRows.push({
          metric: matchLabel,
          build1,
          build2,
          delta,
        });
        i += 4;
        continue;
      }
    }
    i += 1;
  }

  const deltaColor = (val) => {
    if (val.startsWith("+")) return "#ef4444";
    if (val.startsWith("-")) return "#10b981";
    return "#6b7280";
  };

  const tableHtml = `
    <div style="margin: 12px 0; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; background: #fff;">
      <div style="background: linear-gradient(135deg, #f3f4f6 0%, #f9fafb 100%); padding: 12px 14px; border-bottom: 2px solid #e5e7eb;">
        <div style="font-size: 13px; font-weight: 700; color: #1f2937;">IB Comparison Report</div>
        <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${architecture}</div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #f3f4f6; border-bottom: 1px solid #d1d5db;">
            <th style="text-align: left; padding: 10px 12px; color: #374151; font-weight: 600;">Metric</th>
            <th style="text-align: right; padding: 10px 12px; color: #374151; font-weight: 600;">Build 1</th>
            <th style="text-align: right; padding: 10px 12px; color: #374151; font-weight: 600;">Build 2</th>
            <th style="text-align: right; padding: 10px 12px; color: #374151; font-weight: 600;">Delta</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows
            .map(
              (row) => `
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px 12px; color: #111827; font-weight: 500;">${row.metric}</td>
              <td style="padding: 10px 12px; text-align: right; color: #374151; font-family: 'Monaco', 'Courier New', monospace; font-size: 12px;">${row.build1}</td>
              <td style="padding: 10px 12px; text-align: right; color: #374151; font-family: 'Monaco', 'Courier New', monospace; font-size: 12px;">${row.build2}</td>
              <td style="padding: 10px 12px; text-align: right; color: ${deltaColor(row.delta)}; font-weight: 600; font-family: 'Monaco', 'Courier New', monospace; font-size: 12px;">${row.delta}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  const workflowMatch = normalized.match(/Changed failing workflows([\s\S]*?)(?=\n\n|$)/);
  const workflows = workflowMatch ? workflowMatch[1].trim().split("\n").filter((line) => line.startsWith("- ")) : [];

  const workflowHtml =
    workflows.length > 0
      ? `
    <div style="margin: 12px 0; padding: 12px 14px; background: #fafafa; border-radius: 6px; border: 1px solid #e5e7eb;">
      <div style="font-size: 12px; font-weight: 700; color: #1f2937; margin-bottom: 8px;">Changed failing workflows</div>
      <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 12px; line-height: 1.6;">
        ${workflows.map((line) => `<li>${line.replace(/^-\s*/, "")}</li>`).join("")}
      </ul>
    </div>
  `
      : "";

  return DOMPurify.sanitize(tableHtml + workflowHtml, { USE_PROFILES: { html: true } });
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [expandedWorkflows, setExpandedWorkflows] = useState({});
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState({});
  const [feedbackResponse, setFeedbackResponse] = useState({});
  const [feedbackLoading, setFeedbackLoading] = useState({});
  const [feedbackError, setFeedbackError] = useState({});
  const [showCorrectionForm, setShowCorrectionForm] = useState(null);
  const [correctionData, setCorrectionData] = useState({ answer: "", ib_tag: "" });
  const [selectedActions, setSelectedActions] = useState({});
  const { messages, loading, error, historyStatus, historyLoading, sendMessage, retryLastMessage, resetChat } = useChat();
  const bodyRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading || historyLoading) return;
    setInput("");
    sendMessage(q);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleAction = (messageIndex, actionIndex, question) => {
    if (loading || historyLoading || selectedActions[messageIndex] !== undefined || !question) return;
    setSelectedActions((current) => ({ ...current, [messageIndex]: actionIndex }));
    sendMessage(question);
  };

  const handleReset = async () => {
    await resetChat();
    setSelectedActions({});
  };

  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = Math.min(Math.max(e.clientX, MIN_PANEL_WIDTH), MAX_PANEL_WIDTH);
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing]);

  const toggleWorkflows = (messageIndex) => {
    setExpandedWorkflows((prev) => ({
      ...prev,
      [messageIndex]: !prev[messageIndex],
    }));
  };

  const getTableFromContent = (content) => {
    const documentFragment = new DOMParser().parseFromString(
      renderMarkdownToHtml(content || ""),
      "text/html"
    );
    return documentFragment.querySelector("table");
  };

  const copyTableToClipboard = (content) => {
    const table = getTableFromContent(content);
    if (!table) return;
    navigator.clipboard.writeText(table.innerText);
  };

  const startEditMessage = (messageIndex, content) => {
    setEditingMessageId(messageIndex);
    setEditingText(content);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const saveEdit = (messageIndex) => {
    const editedText = editingText.trim();
    if (!editedText) return;
    setEditingMessageId(null);
    setEditingText("");
    sendMessage(editedText);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const extractTableData = (content) => {
    const table = getTableFromContent(content);
    if (!table) return { headers: [], rows: [] };

    const headers = [];
    const rows = [];

    table.querySelectorAll("thead th").forEach((th) => {
      headers.push(th.textContent.trim());
    });

    table.querySelectorAll("tbody tr").forEach((tr) => {
      const row = [];
      tr.querySelectorAll("td").forEach((td) => {
        row.push(td.textContent.trim());
      });
      if (row.length > 0) rows.push(row);
    });

    return { headers, rows };
  };

  const downloadFile = (content, type, extension) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `table-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloadMenuOpen(null);
  };

  const downloadTableAsCSV = (content) => {
    const { headers, rows } = extractTableData(content);
    if (headers.length === 0) return;

    let csv = headers.map((header) => `"${header.replace(/"/g, '""')}"`).join(",") + "\n";
    rows.forEach((row) => {
      csv += row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",") + "\n";
    });

    downloadFile(`\uFEFF${csv}`, "text/csv;charset=utf-8", "csv");
  };

  const downloadTableAsJSON = (content) => {
    const { headers, rows } = extractTableData(content);
    if (headers.length === 0) return;

    const data = rows.map((row) => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx];
      });
      return obj;
    });

    const json = JSON.stringify(data, null, 2);
    downloadFile(json, "application/json", "json");
  };

  const downloadTableAsPDF = (content) => {
    const table = getTableFromContent(content);
    if (!table) return;

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>CMSSDT Table</title>
          <style>
            body { font-family: sans-serif; margin: 24px; color: #111827; }
            h1 { font-size: 18px; margin: 0 0 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { padding: 6px 8px; border: 1px solid #d1d5db; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>CMSSDT Table Export</h1>
          ${table.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setDownloadMenuOpen(null);
  };

  const submitFeedback = async (messageIndex, verdict) => {
    if (feedbackSubmitted[messageIndex]) return;
    if (!CMSSDT_API_BASE) {
      setFeedbackError((prev) => ({
        ...prev,
        [messageIndex]: "Feedback is unavailable: VITE_CMSSDT_API_BASE is not configured.",
      }));
      return;
    }

    const assistantMessage = messages[messageIndex]?.content || "";
    if (!assistantMessage) {
      console.error("Assistant message not found at index", messageIndex);
      return;
    }

    // Find the preceding user message
    let userMessage = "";
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") {
        userMessage = messages[i].content;
        break;
      }
    }

    const payload = {
      question: userMessage,
      answer: assistantMessage,
      verdict: verdict,
    };

    setFeedbackError((prev) => ({ ...prev, [messageIndex]: "" }));
    setFeedbackLoading((prev) => ({ ...prev, [messageIndex]: true }));

    try {
      const response = await fetch(`${CMSSDT_API_BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();
      console.log("Feedback response:", response.status, responseData);

      if (response.ok) {
        setFeedbackSubmitted((prev) => ({ ...prev, [messageIndex]: verdict }));
        setFeedbackResponse((prev) => ({ ...prev, [messageIndex]: responseData }));
      } else {
        console.error("Feedback submission failed:", response.status, responseData);
        setFeedbackError((prev) => ({
          ...prev,
          [messageIndex]: `Feedback could not be submitted: ${responseData.detail || response.status}`,
        }));
      }
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      setFeedbackError((prev) => ({
        ...prev,
        [messageIndex]: `Feedback could not be submitted: ${err.message}`,
      }));
    } finally {
      setFeedbackLoading((prev) => ({ ...prev, [messageIndex]: false }));
    }
  };

  const submitCorrectedFeedback = async (messageIndex) => {
    if (!CMSSDT_API_BASE) {
      setFeedbackError((prev) => ({
        ...prev,
        [messageIndex]: "Feedback is unavailable: VITE_CMSSDT_API_BASE is not configured.",
      }));
      return;
    }

    const assistantMessage = messages[messageIndex]?.content || "";
    if (!assistantMessage) {
      console.error("Assistant message not found at index", messageIndex);
      return;
    }

    // Find the preceding user message
    let userMessage = "";
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") {
        userMessage = messages[i].content;
        break;
      }
    }

    const payload = {
      question: userMessage,
      answer: assistantMessage,
      verdict: "incorrect",
    };

    const correctedAnswer = correctionData.answer.trim();
    const ibTag = correctionData.ib_tag.trim();
    if (correctedAnswer) {
      payload.corrected_answer = correctedAnswer;
    }
    if (ibTag && CMSSW_TAG_PATTERN.test(ibTag)) {
      payload.ib_tag = ibTag;
    }

    setFeedbackError((prev) => ({ ...prev, [messageIndex]: "" }));
    setFeedbackLoading((prev) => ({ ...prev, [messageIndex]: true }));

    try {
      const response = await fetch(`${CMSSDT_API_BASE}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();
      console.log("Corrected feedback response:", response.status, responseData);

      if (response.ok) {
        setFeedbackSubmitted((prev) => ({ ...prev, [messageIndex]: "incorrect" }));
        setFeedbackResponse((prev) => ({ ...prev, [messageIndex]: responseData }));
        setShowCorrectionForm(null);
        setCorrectionData({ answer: "", ib_tag: "" });
      } else {
        console.error("Corrected feedback submission failed:", response.status, responseData);
        setFeedbackError((prev) => ({
          ...prev,
          [messageIndex]: `Feedback could not be submitted: ${responseData.detail || response.status}`,
        }));
      }
    } catch (err) {
      console.error("Failed to submit corrected feedback:", err);
      setFeedbackError((prev) => ({
        ...prev,
        [messageIndex]: `Feedback could not be submitted: ${err.message}`,
      }));
    } finally {
      setFeedbackLoading((prev) => ({ ...prev, [messageIndex]: false }));
    }
  };

  return (
    <>
      {/* Toggle tab — always visible on the left edge, slides with the panel
          so it doubles as the close handle when open. */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={open ? "Close chat" : "Ask the CMSSDT AI Chatbot"}
        style={{
          position: "fixed",
          bottom: 24,
          left: open ? panelWidth : 0,
          zIndex: 1060,
          width: 44,
          height: 64,
          border: "none",
          borderRadius: "0 8px 8px 0",
          background: "#0d6efd",
          color: "#fff",
          fontSize: 20,
          boxShadow: "2px 0 8px rgba(0,0,0,0.2)",
          transition: "left 0.3s ease",
          cursor: "pointer",
        }}
      >
        {open ? "‹" : "💬"}
      </button>

      {/* Sliding panel */}
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: panelWidth,
          background: "#fff",
          boxShadow: "2px 0 16px rgba(0,0,0,0.25)",
          zIndex: 1055,
          display: "flex",
          flexDirection: "column",
          transform: `translateX(${open ? "0" : "-100%"})`,
          transition: "transform 0.3s ease",
        }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: "4px",
            height: "100%",
            cursor: "col-resize",
            background: isResizing ? "#0d6efd" : "transparent",
            transition: "background 0.2s",
          }}
          title="Drag to resize"
        />

        <div className="d-flex justify-content-between align-items-center p-2 border-bottom bg-light">
          <span className="fw-semibold" style={{ fontSize: "12px" }}>CMSSDT AI Chatbot</span>
          <div style={{ display: "flex", gap: "4px" }}>
            <Button
              size="sm"
              variant="link"
              onClick={handleReset}
              title="New conversation (Cmd/Ctrl+Shift+L)"
              style={{ padding: "2px 4px", fontSize: "12px" }}
            >
              ↺
            </Button>
          </div>
        </div>

        <div ref={bodyRef} className="flex-grow-1" style={{ overflowY: "auto", padding: "10px 8px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {historyStatus && (
            <div className="text-muted" style={{ fontSize: "11px", lineHeight: "1.4" }}>
              {historyStatus}
            </div>
          )}
          {messages.length === 0 && (
            <div className="text-muted" style={{ fontSize: "12px", lineHeight: "1.4" }}>
              Ask about clang warnings, RelVals, unit tests, or PRs — e.g. "How many
              warnings are in Alignment/OfflineValidation?"
            </div>
          )}
          {messages.map((m, i) => {
            const hasTable = Boolean(getTableFromContent(m.content));
            const hasWorkflows = m.content && m.content.includes("Changed failing workflows");
            const hasCode = m.content && (m.content.includes("```") || m.content.includes("`PR"));
            const isEditing = editingMessageId === i;
            const actions = m.role === "assistant" && Array.isArray(m.actions) ? m.actions : [];
            const selectedAction = selectedActions[i];
            const isScopeChoice = m.isClarification || actions.length > 0;

            return (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", width: "100%", alignItems: "flex-start", gap: "6px" }}>
                <div
                  data-message-id={i}
                  className={`rounded ${
                    m.role === "user" ? "bg-primary text-white" : "bg-light border"
                  }`}
                  style={{
                    maxWidth: "85%",
                    padding: "8px 10px",
                    fontSize: "12px",
                    lineHeight: "1.4",
                    textAlign: "left",
                    overflowWrap: "break-word",
                    wordBreak: "break-word",
                    position: "relative",
                  }}
                >
                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: "4px",
                          border: "1px solid #0d6efd",
                          fontSize: "12px",
                          fontFamily: "inherit",
                          minHeight: "60px",
                          resize: "none",
                        }}
                      />
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => saveEdit(i)}
                          style={{ padding: "2px 8px", fontSize: "11px" }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={cancelEdit}
                          style={{ padding: "2px 8px", fontSize: "11px" }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {m.role === "assistant" && isScopeChoice && (
                        <div style={{ color: "#0d6efd", fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em", marginBottom: "5px", textTransform: "uppercase" }}>
                          Choose a scope
                        </div>
                      )}
                      {hasTable && m.role === "assistant" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => copyTableToClipboard(m.content)}
                            style={{
                              position: "absolute",
                              top: "4px",
                              right: "50px",
                              padding: "2px 4px",
                              fontSize: "10px",
                            }}
                            title="Copy table"
                          >
                            📋
                          </Button>
                          <div style={{ position: "absolute", top: "4px", right: "4px" }}>
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              onClick={() => setDownloadMenuOpen(downloadMenuOpen === i ? null : i)}
                              style={{
                                padding: "2px 4px",
                                fontSize: "10px",
                              }}
                              title="Download table"
                            >
                              ⬇️
                            </Button>
                            {downloadMenuOpen === i && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "24px",
                                  right: "0px",
                                  backgroundColor: "white",
                                  border: "1px solid #dee2e6",
                                  borderRadius: "4px",
                                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                  zIndex: 1000,
                                  minWidth: "100px",
                                }}
                              >
                                <Button
                                  size="sm"
                                  variant="link"
                                  onClick={() => downloadTableAsCSV(m.content)}
                                  style={{
                                    display: "block",
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "6px 12px",
                                    fontSize: "12px",
                                    border: "none",
                                    textDecoration: "none",
                                    color: "#0d6efd",
                                  }}
                                >
                                  📊 CSV
                                </Button>
                                <Button
                                  size="sm"
                                  variant="link"
                                  onClick={() => downloadTableAsJSON(m.content)}
                                  style={{
                                    display: "block",
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "6px 12px",
                                    fontSize: "12px",
                                    border: "none",
                                    textDecoration: "none",
                                    color: "#0d6efd",
                                  }}
                                >
                                  JSON
                                </Button>
                                <Button
                                  size="sm"
                                  variant="link"
                                  onClick={() => downloadTableAsPDF(m.content)}
                                  style={{
                                    display: "block",
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "6px 12px",
                                    fontSize: "12px",
                                    border: "none",
                                    textDecoration: "none",
                                    color: "#0d6efd",
                                  }}
                                >
                                  PDF
                                </Button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      {hasCode && m.role === "assistant" && (
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => copyToClipboard(m.content)}
                          style={{
                            position: "absolute",
                            top: "4px",
                            right: hasTable ? "92px" : "4px",
                            padding: "2px 4px",
                            fontSize: "10px",
                          }}
                          title="Copy content"
                        >
                          📄
                        </Button>
                      )}
                      {(() => {
                        const content = m.content || "";
                        const split = m.role === "assistant" ? splitContentAroundTable(content) : null;
                        const tableData = split ? extractTableData(split.tableMarkdown) : null;

                        if (split && tableData && isGroupableTable(tableData.headers, tableData.rows)) {
                          return (
                            <>
                              {split.intro.trim() && (
                                <div className="chat-message-content" dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(split.intro) }} />
                              )}
                              <GroupedResultTable headers={tableData.headers} rows={tableData.rows} />
                              {split.outro.trim() && (
                                <div className="chat-message-content" dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(split.outro) }} />
                              )}
                            </>
                          );
                        }

                        return (
                          <div className="chat-message-content" dangerouslySetInnerHTML={{
                            __html: renderMarkdownToHtml(content),
                          }} />
                        );
                      })()}
                      {actions.length > 0 && (
                        <div aria-label="Scope choices" style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" }}>
                          {actions.map((action, actionIndex) => {
                            const isSelected = selectedAction === actionIndex;
                            return (
                              <Button
                                key={`${action.label}-${actionIndex}`}
                                size="sm"
                                variant={isSelected ? "primary" : "outline-primary"}
                                onClick={() => handleAction(i, actionIndex, action.question)}
                                disabled={loading || historyLoading || selectedAction !== undefined || !action.question}
                                style={{ padding: "3px 7px", fontSize: "11px", maxWidth: "100%", overflowWrap: "anywhere" }}
                              >
                                {action.label || "Choose"}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                      {hasWorkflows && m.role === "assistant" && (
                        <Button
                          size="sm"
                          variant="link"
                          onClick={() => toggleWorkflows(i)}
                          style={{
                            padding: "2px 4px",
                            fontSize: "10px",
                            marginTop: "4px",
                            display: "block",
                            textDecoration: "none",
                          }}
                        >
                          {expandedWorkflows[i] ? "▼" : "▶"} {expandedWorkflows[i] ? "Hide" : "Show"} workflows
                        </Button>
                      )}
                      {m.role === "assistant" && (
                        <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
                          <Button
                            size="sm"
                            variant={feedbackSubmitted[i] === "correct" ? "success" : "outline-secondary"}
                            onClick={() => submitFeedback(i, "correct")}
                            disabled={!!feedbackSubmitted[i] || feedbackLoading[i]}
                            style={{
                              padding: "2px 6px",
                              fontSize: "11px",
                            }}
                            title="This answer is correct"
                          >
                            {feedbackLoading[i] ? "..." : "👍"}
                          </Button>
                          <Button
                            size="sm"
                            variant={feedbackSubmitted[i] === "incorrect" ? "danger" : "outline-secondary"}
                            onClick={() => {
                              if (!feedbackSubmitted[i]) {
                                setShowCorrectionForm(i);
                              }
                            }}
                            disabled={!!feedbackSubmitted[i] || feedbackLoading[i]}
                            style={{
                              padding: "2px 6px",
                              fontSize: "11px",
                            }}
                            title="This answer is incorrect"
                          >
                            {feedbackLoading[i] ? "..." : "👎"}
                          </Button>
                        </div>
                      )}
                      {showCorrectionForm === i && (
                        <div style={{ marginTop: "8px", padding: "8px", backgroundColor: "#fff3cd", borderRadius: "4px" }}>
                          <div style={{ fontSize: "11px", fontWeight: "500", marginBottom: "6px" }}>Provide correction:</div>
                          <textarea
                            value={correctionData.answer}
                            onChange={(e) => setCorrectionData({ ...correctionData, answer: e.target.value })}
                            placeholder="What is the correct answer?"
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              borderRadius: "4px",
                              border: "1px solid #ffc107",
                              fontSize: "11px",
                              minHeight: "50px",
                              resize: "none",
                              marginBottom: "6px",
                            }}
                          />
                          <input
                            type="text"
                            value={correctionData.ib_tag}
                            onChange={(e) => setCorrectionData({ ...correctionData, ib_tag: e.target.value })}
                            placeholder="IB tag (optional, e.g., CMSSW_20_1_X_2026-08-10-1100)"
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              borderRadius: "4px",
                              border: "1px solid #ffc107",
                              fontSize: "11px",
                              marginBottom: "6px",
                            }}
                          />
                          <div style={{ display: "flex", gap: "4px" }}>
                            <Button
                              size="sm"
                              variant="warning"
                              onClick={() => submitCorrectedFeedback(i)}
                              disabled={feedbackLoading[i]}
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                            >
                              {feedbackLoading[i] ? "Submitting..." : "Submit"}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setShowCorrectionForm(null);
                                setCorrectionData({ answer: "", ib_tag: "" });
                              }}
                              disabled={feedbackLoading[i]}
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                      {feedbackError[i] && (
                        <div
                          role="alert"
                          style={{
                            marginTop: "8px",
                            padding: "8px",
                            borderRadius: "4px",
                            backgroundColor: "#f8d7da",
                            borderLeft: "3px solid #dc3545",
                            color: "#842029",
                            fontSize: "11px",
                          }}
                        >
                          {feedbackError[i]}
                        </div>
                      )}
                      {feedbackResponse[i] && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "8px",
                            borderRadius: "4px",
                            backgroundColor:
                              feedbackResponse[i].status === "accepted"
                                ? "#d4edda"
                                : feedbackResponse[i].status === "rejected"
                                ? "#f8d7da"
                                : "#fff3cd",
                            borderLeft: `3px solid ${
                              feedbackResponse[i].status === "accepted"
                                ? "#28a745"
                                : feedbackResponse[i].status === "rejected"
                                ? "#dc3545"
                                : "#ffc107"
                            }`,
                            fontSize: "11px",
                          }}
                        >
                          <div style={{ fontWeight: "600", marginBottom: "4px" }}>
                            {feedbackResponse[i].status === "accepted"
                              ? "✓ Verified"
                              : feedbackResponse[i].status === "rejected"
                              ? "✗ Rejected"
                              : "⏳ Pending Review"}
                          </div>
                          {feedbackResponse[i].verification && (
                            <div style={{ marginBottom: "4px", fontStyle: "italic" }}>
                              {feedbackResponse[i].verification}
                            </div>
                          )}
                          {feedbackResponse[i].message && (
                            <div>{feedbackResponse[i].message}</div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {m.role === "user" && !isEditing && (
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => startEditMessage(i, m.content)}
                    style={{
                      padding: "2px 6px",
                      fontSize: "11px",
                      height: "fit-content",
                      marginTop: "2px",
                      flexShrink: 0,
                    }}
                    title="Edit message"
                  >
                    Edit
                  </Button>
                )}
              </div>
            );
          })}
          {loading && <div className="d-flex align-items-center gap-2 text-muted" style={{ alignSelf: "flex-start", marginTop: "4px", fontSize: "11px" }}><Spinner animation="border" size="sm" /> Querying CMSSDT...</div>}
          {error && (
            <div role="alert" className="d-flex align-items-center justify-content-between text-danger" style={{ fontSize: "12px", gap: "8px" }}>
              <span>{error}</span>
              <Button size="sm" variant="outline-danger" onClick={retryLastMessage} disabled={loading || historyLoading} title="Retry last question" aria-label="Retry last question" style={{ padding: "2px 5px" }}>↻</Button>
            </div>
          )}
        </div>

        <div style={{ padding: "8px", borderTop: "1px solid #dee2e6", backgroundColor: "#f8f9fa", flexShrink: 0 }}>
          <Form onSubmit={handleSubmit} className="d-flex gap-1">
            <Form.Control
              as="textarea"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask a question..."
              disabled={loading || historyLoading}
              autoFocus={open}
              style={{ fontSize: "12px", padding: "6px 8px", height: "auto", resize: "vertical" }}
            />
            <Button type="submit" disabled={loading || historyLoading || !input.trim()} size="sm" style={{ padding: "6px 12px", fontSize: "12px" }}>
              Send
            </Button>
          </Form>
          <div className="text-muted" style={{ fontSize: "10px", marginTop: "4px" }}>Enter to send · Shift+Enter for newline</div>
        </div>
      </div>
    </>
  );
}