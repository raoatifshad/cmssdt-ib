import React, { useEffect, useMemo, useRef, useState } from "react";
import { Form } from "react-bootstrap";
import { FaSearch } from "react-icons/fa";
import { theme } from "./theme";

// Small searchable combobox - matches this app's existing search-box convention
// (Form.Control + FaSearch, as used in IBPageComponents/RelvalsLabel.js /
// UnitTestsLabel.js) rather than a plain <select>, since release-cycle lists here can run
// into the hundreds and a native dropdown isn't browsable at that length.
const SearchableSelect = ({ label, value, options, onChange, placeholder = "Search…", disabled = false, minWidth = 220 }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth }}>
      {label && (
        <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: theme.textMuted, marginBottom: 4 }}>
          {label}
        </div>
      )}
      <div style={{ position: "relative" }}>
        <FaSearch size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: theme.textMuted }} />
        <Form.Control
          size="sm"
          disabled={disabled}
          value={open ? query : selected?.label || ""}
          placeholder={disabled ? "—" : selected?.label || placeholder}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            paddingLeft: 28,
            background: theme.page,
            color: theme.text,
            border: `1px solid ${theme.border}`,
          }}
        />
      </div>

      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            maxHeight: 260,
            overflowY: "auto",
            background: theme.surface,
            border: `1px solid ${theme.borderStrong}`,
            borderRadius: 10,
            boxShadow: "0 12px 24px -8px rgba(0,0,0,0.5)",
            zIndex: 20,
          }}
        >
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
                setQuery("");
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "7px 12px",
                border: "none",
                background: o.value === value ? "rgba(59, 130, 246, 0.16)" : "transparent",
                color: theme.text,
                fontSize: "0.82rem",
                fontFamily: o.mono ? theme.mono : undefined,
                cursor: "pointer",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
