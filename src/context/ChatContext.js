// Drop-in location (per the app's documented structure): src/context/ChatContext.js
//
// Follows the same shape every other context in this app uses (per CLAUDE.md:
// ExitCodeContext, CommandContext, ShowArchContext, RelValStore) —
// createContext + useReducer + a use<Name>() hook. NOT verified against the
// actual repo source (only built from the documented architecture) — check
// this matches the real pattern in src/context/ShowArchContext.js once you
// drop this in, and adjust naming/conventions to match if they differ.
import React, { createContext, useContext, useReducer, useCallback, useEffect } from "react";

const ChatContext = createContext(null);

// Matches the existing VITE_CMSSDT_SERVER convention (.env.development /
// .env.production) — add VITE_CHAT_API_BASE alongside it. Point it at the
// FastAPI server's address; for local prototype use that's
// http://localhost:8000 (see server/api_server.py in the cmssdt-chatbot repo).
const CHAT_API_BASE = import.meta.env.VITE_CHAT_API_BASE || "http://localhost:8000";
const SESSION_STORAGE_KEY = "cmssdt-session";

const getStoredSessionId = () => sessionStorage.getItem(SESSION_STORAGE_KEY);

const normalizeMessage = (message) => ({
  role: message?.role === "user" ? "user" : "assistant",
  content: String(message?.content || ""),
  actions: Array.isArray(message?.actions) ? message.actions : [],
  isClarification: Boolean(message?.isClarification),
});

function chatReducer(state, action) {
  switch (action.type) {
    case "SEND_START":
      return {
        ...state,
        messages: [...state.messages, { role: "user", content: action.question }],
        loading: true,
        error: null,
      };
    case "SEND_SUCCESS":
      return {
        ...state,
        messages: [...state.messages, normalizeMessage(action.message)],
        sessionId: action.sessionId,
        loading: false,
      };
    case "RESTORE_SUCCESS":
      return {
        ...state,
        messages: action.messages.map(normalizeMessage),
        sessionId: action.sessionId,
        historyStatus: null,
        historyLoading: false,
      };
    case "HISTORY_STATUS":
      return { ...state, historyStatus: action.message, historyLoading: false };
    case "SEND_ERROR":
      return { ...state, loading: false, error: action.error };
    case "RESET":
      return {
        messages: [],
        sessionId: null,
        loading: false,
        error: null,
        historyStatus: null,
        historyLoading: false,
      };
    default:
      return state;
  }
}

const initialState = {
  messages: [],
  sessionId: getStoredSessionId(),
  loading: false,
  error: null,
  lastQuestion: null,
  historyStatus: null,
  historyLoading: Boolean(getStoredSessionId()),
};

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  useEffect(() => {
    const sessionId = getStoredSessionId();
    if (!sessionId) return;

    const restoreHistory = async () => {
      try {
        const res = await fetch(`${CHAT_API_BASE}/api/chat/${sessionId}/history`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Saved conversation was not found." : `Request failed (${res.status})`);
        }
        const data = await res.json();
        dispatch({
          type: "RESTORE_SUCCESS",
          sessionId: data.session_id,
          messages: Array.isArray(data.turns) ? data.turns : [],
        });
      } catch (err) {
        dispatch({
          type: "HISTORY_STATUS",
          message: `Could not restore saved conversation: ${err.message}`,
        });
      }
    };

    restoreHistory();
  }, []);

  const sendMessage = useCallback(
    async (question) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion || state.loading || state.historyLoading) return;

      dispatch({ type: "SEND_START", question: trimmedQuestion });
      try {
        const res = await fetch(`${CHAT_API_BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmedQuestion, session_id: state.sessionId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `Request failed (${res.status})`);
        }
        const data = await res.json();
        if (!data.session_id || typeof data.answer !== "string") {
          throw new Error("The chatbot returned an incomplete response.");
        }
        sessionStorage.setItem(SESSION_STORAGE_KEY, data.session_id);
        dispatch({
          type: "SEND_SUCCESS",
          sessionId: data.session_id,
          message: {
            role: "assistant",
            content: data.answer,
            actions: data.actions,
            isClarification: data.is_clarification || data.needs_clarification || data.response_type === "clarification",
          },
        });
      } catch (err) {
        dispatch({
          type: "SEND_ERROR",
          error: err.message || "Could not reach the chatbot backend — is it running?",
        });
      }
    },
    [state.historyLoading, state.loading, state.sessionId]
  );

  const retryLastMessage = useCallback(() => {
    const lastUserMessage = [...state.messages].reverse().find((message) => message.role === "user");
    if (lastUserMessage) sendMessage(lastUserMessage.content);
  }, [sendMessage, state.messages]);

  const resetChat = useCallback(async () => {
    if (state.sessionId) {
      try {
        const res = await fetch(`${CHAT_API_BASE}/api/chat/${state.sessionId}`, { method: "DELETE" });
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }
      } catch (err) {
        dispatch({
          type: "HISTORY_STATUS",
          message: `Could not clear conversation: ${err.message}`,
        });
        return;
      }
    }
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    dispatch({ type: "RESET" });
  }, [state.sessionId]);

  return (
    <ChatContext.Provider value={{ ...state, sendMessage, retryLastMessage, resetChat }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return ctx;
}