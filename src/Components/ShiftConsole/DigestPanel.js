import React, { useEffect, useMemo, useState } from "react";
import { BsCheckCircle } from "react-icons/bs";
import { FaCode, FaHammer, FaProjectDiagram, FaPuzzlePiece, FaVial } from "react-icons/fa";
import { buildDigestDocument, renderInline, isEmptySection } from "./shiftMarkdown";
import { archStats, classifySection } from "./digestStats";
import { theme, TONE, CATEGORY } from "./theme";
import ArchMatrix from "./ArchMatrix";
import WorkflowTable from "./WorkflowTable";
import PanelState from "./PanelState";

const SectionBlock = ({ block }) => {
  if (block.type === "table") {
    return <WorkflowTable header={block.header} rows={block.rows} />;
  }
  if (block.type === "list") {
    return (
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {block.items.map((item, idx) => (
          <li key={idx} style={{ marginBottom: 4, color: theme.textSecondary, fontSize: "0.9rem" }}>
            {renderInline(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "paragraph") {
    return <p style={{ margin: 0, color: theme.textSecondary, fontSize: "0.9rem" }}>{renderInline(block.text)}</p>;
  }
  return null;
};

const subsectionTone = (heading) => {
  if (/newly failing/i.test(heading)) return "danger";
  if (/resolved/i.test(heading)) return "success";
  return null;
};

const SUBSECTION_LABEL = { danger: "New failures", success: "Resolved" };

// A single #### subsection inside a group card - only ever rendered when it has content,
// so the group card never has to say "None." on its own.
const DigestSubsection = ({ section }) => {
  const tone = subsectionTone(section.heading);
  const t = tone && TONE[tone];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <h5 style={{ fontSize: "0.85rem", fontWeight: 700, color: theme.text, margin: 0 }}>{renderInline(section.heading)}</h5>
        {t && (
          <span
            style={{
              fontSize: "0.64rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: t.fg,
              background: t.tint,
              border: `1px solid ${t.ring}`,
              borderRadius: 999,
              padding: "2px 9px",
            }}
          >
            {SUBSECTION_LABEL[tone]}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {section.blocks.map((block, idx) => (
          <SectionBlock key={idx} block={block} />
        ))}
      </div>
    </div>
  );
};

// Icon + accent per group - lets a shifter tell "what kind of check is this" apart at a
// glance (RelVal vs Unit Test vs Build vs AddOn vs Clang), the way GitHub Actions/Datadog
// differentiate check *type* via icon while keeping severity color (red/green) constant.
const GROUP_META = {
  relval: { title: "RelVal workflows", empty: "No RelVal workflow changes this shift.", icon: FaProjectDiagram, color: CATEGORY.relval.fg },
  clang: { title: "Clang warnings", empty: "No Clang warning changes this shift.", icon: FaCode, color: CATEGORY.clang.fg },
  builds: { title: "Builds", empty: "No build changes this shift.", icon: FaHammer, color: CATEGORY.builds.fg },
  utests: { title: "Unit Tests", empty: "No Unit Test changes this shift.", icon: FaVial, color: CATEGORY.utests.fg },
  addons: { title: "AddOn tests", empty: "No AddOn test changes this shift.", icon: FaPuzzlePiece, color: CATEGORY.addons.fg },
};

// Collapses the backend's five stacked #### sections into two focused cards, and drops
// each one entirely to a single line when there's nothing to report - a clean
// architecture used to cost five "None." headings of scroll for no information.
const SectionGroupCard = ({ groupKey, sections }) => {
  const meta = GROUP_META[groupKey];
  const Icon = meta.icon;
  const nonEmpty = sections.filter((section) => !isEmptySection(section));

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 18 }}>
      <h4 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.92rem", fontWeight: 700, color: theme.text, margin: "0 0 12px" }}>
        <Icon size={13} color={meta.color} />
        {meta.title}
      </h4>
      {nonEmpty.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: TONE.success.fg, fontSize: "0.86rem" }}>
          <BsCheckCircle size={14} /> {meta.empty}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {nonEmpty.map((section, idx) => (
            <DigestSubsection key={idx} section={section} />
          ))}
        </div>
      )}
    </div>
  );
};

const ArchDetail = ({ arch }) => {
  const groups = useMemo(() => {
    const buckets = { relval: [], clang: [], builds: [], utests: [], addons: [], other: [] };
    arch.sections.forEach((section) => buckets[classifySection(section.heading)].push(section));
    return buckets;
  }, [arch]);

  return (
    <div>
      {/* Stacked full-width, not side-by-side: RelVal workflow tables carry a long Name
          column plus Errors/Exit code - splitting the row in half pushed those columns
          behind an easy-to-miss horizontal scrollbar. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {groups.relval.length > 0 && <SectionGroupCard groupKey="relval" sections={groups.relval} />}
        {groups.clang.length > 0 && <SectionGroupCard groupKey="clang" sections={groups.clang} />}
        {groups.builds.length > 0 && <SectionGroupCard groupKey="builds" sections={groups.builds} />}
        {groups.utests.length > 0 && <SectionGroupCard groupKey="utests" sections={groups.utests} />}
        {groups.addons.length > 0 && <SectionGroupCard groupKey="addons" sections={groups.addons} />}
      </div>

      {groups.other.length > 0 && (
        <div style={{ marginTop: 16, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {groups.other.map((section, idx) => (
              <DigestSubsection key={idx} section={section} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DigestPanel = ({ markdown, loading, error, onRetry }) => {
  const doc = useMemo(() => buildDigestDocument(markdown), [markdown]);
  const [activeIdx, setActiveIdx] = useState(0);

  // Jump back to the first architecture whenever a new digest comes in (e.g. after a
  // refresh or an architecture-filter change) so a stale index never points past the end.
  useEffect(() => {
    setActiveIdx(0);
  }, [doc.archs.length, markdown]);

  if (loading) return <PanelState kind="loading" text="Loading shift digest…" />;
  if (error) return <PanelState kind="error" text="Couldn't load the shift digest." onRetry={onRetry} />;

  if (!doc.archs.length) {
    return <PanelState kind="empty" text="No digest data available." />;
  }

  const statsByArch = doc.archs.map(archStats);
  const activeArch = doc.archs[Math.min(activeIdx, doc.archs.length - 1)];

  return (
    <div>
      {doc.archs.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <ArchMatrix archs={doc.archs} statsByArch={statsByArch} activeIdx={activeIdx} onSelect={setActiveIdx} />
        </div>
      )}
      <ArchDetail arch={activeArch} />
    </div>
  );
};

export default DigestPanel;
