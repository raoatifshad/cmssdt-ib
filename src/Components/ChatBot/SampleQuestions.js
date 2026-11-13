// Sample questions for an empty chat (2026-11-13): people new to the chat see what they can ask, and click to ask it.
// The list comes from the chat backend (GET /api/sample-questions, the same list as its "help" reply), so it changes with the
// bot; the one below is only used when that call fails. A "chain" group is one conversation: each step follows up on the last.
import React, { useEffect, useState } from "react";
import { CHAT_API_BASE } from "../../context/ChatContext";

const FALLBACK = {
  groups: [
    { title: "Start here", items: [
      { label: "Latest IB", question: "what is the latest IB?" },
      { label: "What is failing?", question: "what is failing in the latest IB?" },
      { label: "Shift summary", question: "give me a shift summary" },
    ] },
    { title: "Follow one failure, step by step", chain: true, items: [
      { label: "What is failing?", question: "what is failing in the latest IB?" },
      { label: "Is it reported?", question: "is it reported on GitHub?" },
      { label: "Which PR caused it?", question: "which PR could have caused it?" },
      { label: "What code did it touch?", question: "what code did that PR touch?" },
    ] },
  ],
  paste_hint: "Or paste an error from a RelVal or unit-test log.",
};

const chipStyle = {
  border: "1px solid #0d6efd", color: "#0d6efd", background: "transparent", borderRadius: "12px",
  padding: "2px 8px", fontSize: "11px", cursor: "pointer", textAlign: "left", maxWidth: "100%", overflowWrap: "anywhere",
};

export default function SampleQuestions({ onAsk, disabled }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${CHAT_API_BASE}/api/sample-questions`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => { if (!cancelled) setData(Array.isArray(body?.groups) && body.groups.length ? body : FALLBACK); })
      .catch(() => { if (!cancelled) setData(FALLBACK); });
    return () => { cancelled = true; };
  }, []);

  const shown = data || FALLBACK;
  return (
    <div style={{ fontSize: "12px", lineHeight: "1.4" }} aria-label="Sample questions">
      <div className="text-muted" style={{ marginBottom: "6px" }}>
        Ask about IBs, RelVals, unit tests, test logs and GitHub PRs/Issues. Click a question to ask it:
      </div>
      {shown.groups.map((group) => (
        <div key={group.title} style={{ marginBottom: "8px" }}>
          <div style={{ fontWeight: 600, fontSize: "11px", marginBottom: "3px" }}>
            {group.title}
            {group.chain && <span className="text-muted" style={{ fontWeight: 400 }}> (one after the other)</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
            {group.items.map((item, index) => (
              <React.Fragment key={`${group.title}-${index}`}>
                {group.chain && index > 0 && <span className="text-muted" aria-hidden="true">→</span>}
                {group.chain && index > 0 ? (
                  // later steps follow up on the answer before: shown as the next step, offered as "Ask next" under that answer
                  <span style={{ ...chipStyle, cursor: "default", borderStyle: "dashed", color: "#6c757d", borderColor: "#adb5bd" }}
                        title={`Ask after step ${index}: "${item.question}"`}>
                    {`${index + 1}. ${item.label}`}
                  </span>
                ) : (
                  <button type="button" style={chipStyle} disabled={disabled} title={item.question} onClick={() => onAsk(item.question)}>
                    {group.chain ? `${index + 1}. ` : ""}{item.label}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
      {shown.paste_hint && <div className="text-muted" style={{ fontSize: "11px" }}>{shown.paste_hint}</div>}
    </div>
  );
}
