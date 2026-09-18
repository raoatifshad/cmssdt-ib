import React from "react";
import { theme, TONE } from "./theme";
import { renderInline } from "./shiftMarkdown";

// Matches one "[category] [cmssw PR #12345](https://.../pull/12345) (merged)" mention from
// the backend's PR/Issue evidence cell (see server/api_server.py's _workflow_evidence_cells).
// Shared by WorkflowTable's per-row evidence drawer and AlertsPanel's Recent Problems cards -
// both need to turn the same raw cell text into the same clickable, state-colored badges.
export const EVIDENCE_MENTION_RE = /(?:\[([^\]]+)\]\s*)?\[cmssw\s+(PR|Issue)\s+#(\d+)\]\(([^)]+)\)\s+\(([^)]+)\)/g;

// merged -> success (a real fix likely already landed); open -> warning (still live, worth a
// look); anything else (closed-without-merge, unknown) -> neutral, since a closed-unmerged
// PR/Issue carries much weaker signal than either of those two.
export function evidenceStateTone(state) {
  const normalized = (state || "").toLowerCase();
  if (normalized === "merged") return TONE.success;
  if (normalized === "open") return TONE.warning;
  return TONE.neutral;
}

// Parses a raw "PR/Issue Evidence" cell into structured mentions - [] for cells with no
// recognizable mention, so callers can just check .length rather than re-deriving that
// distinction. The backend sends "" (blank) for "nothing matched this build specifically" -
// trimming first means a lone-whitespace cell counts as blank too, and matchAll on an empty
// string is already a no-op, so no separate empty-string branch is needed here. (An earlier
// backend revision instead sent a fixed placeholder sentence for "no match" - never
// recognized by EVIDENCE_MENTION_RE either, so this function's behavior didn't change when
// that switched to blank; only WorkflowTable's "does this row have anything to show" check,
// which looked at raw cell text rather than parsed mentions, actually depended on it being
// blank vs. non-blank text.)
export function parseEvidenceMentions(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return [];
  return [...trimmed.matchAll(EVIDENCE_MENTION_RE)].map((match) => ({
    category: match[1] || null,
    kind: match[2],
    number: match[3],
    url: match[4],
    state: match[5],
  }));
}

export const EvidenceBadge = ({ category, kind, number, url, state }) => {
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
// "relevance only, do not prove ..." caveat as a small muted caption. Returns null for a
// blank cell (the backend's "nothing matched this build" signal - callers should render
// nothing for the row, not a placeholder) and falls back to plain renderInline for the rare
// non-blank cell that isn't in the expected mention shape.
export function renderPrIssueEvidence(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const mentions = parseEvidenceMentions(trimmed);
  if (mentions.length === 0) return renderInline(trimmed);
  const caveatIdx = trimmed.indexOf(" -- ");
  const caveat = caveatIdx !== -1 ? trimmed.slice(caveatIdx + 4) : null;
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {mentions.map((m, idx) => (
          <EvidenceBadge key={idx} category={m.category} kind={m.kind} number={m.number} url={m.url} state={m.state} />
        ))}
      </div>
      {caveat && <div style={{ color: theme.textMuted, fontSize: "0.76rem", marginTop: 2 }}>{caveat}</div>}
    </div>
  );
}

// Which state wins when summarizing a list of mentions down to one badge/color: open (still
// live, worth a look) beats merged (a fix likely already landed) beats anything else.
export function evidenceSummaryTone(mentions) {
  if (mentions.some((m) => (m.state || "").toLowerCase() === "open")) return TONE.warning;
  if (mentions.some((m) => (m.state || "").toLowerCase() === "merged")) return TONE.success;
  return TONE.neutral;
}

// Small always-visible pill for a list of mentions - e.g. next to a Recent Problems item's
// name. The full per-mention EvidenceBadge row is too wide for that density, but a shifter
// should still see "there's already a PR/Issue for this" without expanding the row. A single
// mention links straight to it; more than one collapses to a count (the row's own expand
// control reveals the full linked list via renderPrIssueEvidence/EvidenceBadge).
export const EvidenceSummaryBadge = ({ mentions }) => {
  if (!mentions || mentions.length === 0) return null;
  const tone = evidenceSummaryTone(mentions);
  const single = mentions.length === 1 ? mentions[0] : null;
  const label = single ? `${single.kind} #${single.number}` : `${mentions.length} linked`;
  const Tag = single ? "a" : "span";
  return (
    <Tag
      href={single ? single.url : undefined}
      target={single ? "_blank" : undefined}
      rel={single ? "noopener noreferrer" : undefined}
      title={single ? `${single.state} — opens on GitHub` : `${mentions.length} linked PR/Issue mentions`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        fontSize: "0.68rem",
        fontWeight: 700,
        padding: "1px 6px",
        borderRadius: 999,
        color: tone.fg,
        background: tone.tint,
        border: `1px solid ${tone.ring}`,
        whiteSpace: "nowrap",
        textDecoration: "none",
        cursor: single ? "pointer" : "default",
      }}
    >
      {label}
    </Tag>
  );
};
