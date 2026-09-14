import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";

// Portaled to document.body (not a CSS-relative child of the hovered cell) and positioned
// from a measured getBoundingClientRect() rather than plain CSS `position: relative` +
// `top`/`left` - ReleaseStatusGrid's table sits inside an `overflow-x: auto` wrapper, which
// per the CSS spec also forces overflow-y to clip once either axis is non-visible, so a
// CSS-positioned popup anchored inside that wrapper would get cut off near the table's
// top/bottom/left/right edges. Portaling escapes that entirely.
const MAX_ITEMS = 8;

const bubbleStyle = {
  position: "fixed",
  zIndex: 2000,
  background: "#ffffff",
  color: "#0f172a",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  boxShadow: "0 10px 28px rgba(15, 23, 42, 0.35)",
  padding: "10px 13px",
  fontSize: "0.8rem",
  lineHeight: 1.5,
  maxWidth: 360,
  pointerEvents: "none",
};

// A hovered circle is one (category, architecture) cell, but that architecture can carry
// several sub-IBs failing the *same* workflow_id (e.g. both "primary" and "ROOT6" hitting
// 140.051) - those are two genuinely different records, not a duplicate, but without the
// variant they render as the identical-looking line twice. Suffixing the variant (when
// it's a real sub-IB, not "primary") disambiguates them the same way the table below
// already does in its own Architecture column.
function bubbleLine(item, categoryKey) {
  const variant = item.variant && item.variant.toLowerCase() !== "primary" ? ` (${item.variant})` : "";
  const base = categoryKey === "relvals" ? `${item.workflow_id} — ${item.name}` : item.name;
  return base + variant;
}

function BubbleContent({ loading, error, items, categoryKey }) {
  if (loading) return "Loading failing workflows…";
  if (error) return "Couldn't load failing workflow detail.";
  if (!items || items.length === 0) return "No detail available.";
  return (
    <div>
      {items.slice(0, MAX_ITEMS).map((item, idx) => (
        <div key={idx} style={{ whiteSpace: "nowrap" }}>
          {bubbleLine(item, categoryKey)}
        </div>
      ))}
      {items.length > MAX_ITEMS && (
        <div style={{ color: "#64748b", fontStyle: "italic", marginTop: 3 }}>+{items.length - MAX_ITEMS} more</div>
      )}
    </div>
  );
}

// Wraps one hoverable cell: shows a white floating card listing the actual failing
// workflow numbers/names for that architecture (from the knowledge-graph backend, not the
// static flavor JSON the grid itself is built from - that only ever carries the count) on
// hover, and simultaneously fires onHover/onHoverEnd so the failing-workflow table below
// can ring-highlight the matching rows in place - the bubble and the table stay in sync,
// covering both "what is this" (bubble, right where you're looking) and "show me the full
// list" (table, already visible below) instead of choosing one over the other.
const HoverBubble = ({ children, loading, error, items, categoryKey, onEnter, onLeave }) => {
  const ref = useRef(null);
  const [rect, setRect] = useState(null);

  const show = () => {
    if (ref.current) setRect(ref.current.getBoundingClientRect());
    onEnter?.();
  };
  const hide = () => {
    setRect(null);
    onLeave?.();
  };

  const left = rect ? Math.min(Math.max(rect.left + rect.width / 2, 180), window.innerWidth - 180) : 0;
  const top = rect ? rect.top - 8 : 0;

  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={hide} style={{ display: "inline-block", cursor: "pointer" }}>
      {children}
      {rect &&
        createPortal(
          <div style={{ ...bubbleStyle, left, top, transform: "translate(-50%, -100%)" }}>
            <BubbleContent loading={loading} error={error} items={items} categoryKey={categoryKey} />
          </div>,
          document.body,
        )}
    </span>
  );
};

export default HoverBubble;
