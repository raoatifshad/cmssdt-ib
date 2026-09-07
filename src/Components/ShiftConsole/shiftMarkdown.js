import React from "react";
import { CODE_CHIP } from "./theme";

// Parses the narrow, backend-controlled Markdown subset used by /api/shift-summary:
// ##/###/#### headings, | pipe | tables |, "- " bullets, **bold**, `code`, and bare "---" rules.
// Ported from the reference client's renderMarkdown() (server/static/shift.html) as a
// block-level parser instead of a string-to-HTML renderer, so the blocks can drive React components.

function splitTableRow(row) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

export function parseShiftMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    const heading = trimmed.match(/^(#{2,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      i++;
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    if (trimmed.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      const header = rows[0] || [];
      const dataRows = rows.length > 1 && isSeparatorRow(rows[1]) ? rows.slice(2) : rows.slice(1);
      blocks.push({ type: "table", header, rows: dataRows });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2).trim());
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{2,4}\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith("- ") &&
      !/^-{3,}$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "paragraph", text: paraLines.join(" ") });
  }

  return blocks;
}

// Groups the flat block list into ## title -> ### architecture -> #### section,
// matching the shape of the shift-summary digest (one block per architecture, with
// "Newly failing" / "Resolved" RelVal subsections underneath).
export function buildDigestDocument(markdown) {
  const blocks = parseShiftMarkdown(markdown);
  const doc = { title: "", archs: [] };
  let currentArch = null;
  let currentSection = null;

  blocks.forEach((block) => {
    if (block.type === "heading" && block.level === 2) {
      doc.title = block.text;
      currentArch = null;
      currentSection = null;
      return;
    }
    if (block.type === "heading" && block.level === 3) {
      currentArch = { name: block.text, sections: [] };
      doc.archs.push(currentArch);
      currentSection = null;
      return;
    }
    if (block.type === "heading" && block.level === 4) {
      currentSection = { heading: block.text, blocks: [] };
      if (currentArch) currentArch.sections.push(currentSection);
      return;
    }
    if (block.type === "rule") return;

    if (currentSection) currentSection.blocks.push(block);
  });

  return doc;
}

const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`)/g;

export function renderInline(text) {
  const value = String(text || "");
  const parts = value.split(INLINE_PATTERN).filter((part) => part !== "");

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} style={CODE_CHIP}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function isEmptySection(section) {
  if (!section || section.blocks.length === 0) return true;
  return section.blocks.every((block) => {
    if (block.type === "paragraph") return /^none\.?$/i.test(block.text.trim());
    if (block.type === "table") return block.rows.length === 0;
    if (block.type === "list") return block.items.length === 0;
    return false;
  });
}
