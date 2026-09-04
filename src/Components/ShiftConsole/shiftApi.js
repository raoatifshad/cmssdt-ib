// All shift-console calls are same-origin (proxied to the backend by Vite in dev / the
// host in prod, see vite.config.js) so the CERN SSO session cookie is sent automatically.
// Never call these with an absolute cross-origin URL - unlike the chat widget, the session
// cookie won't carry over.
export async function fetchShiftJson(path) {
  const res = await fetch(path, { credentials: "include" });

  if (res.status === 401) {
    const err = new Error("No shift-console session");
    err.kind = "unauthorized";
    throw err;
  }
  if (res.status === 403) {
    const err = new Error("Not on the shift-console allowlist");
    err.kind = "forbidden";
    throw err;
  }
  if (res.status === 503) {
    const err = new Error("CERN SSO not configured");
    err.kind = "unavailable";
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`Request failed (${res.status})`);
    err.kind = "error";
    throw err;
  }

  return res.json();
}

// Past shift-summary windows a shifter can pick between, newest first - see
// GET /api/shift-summary/windows and the from/to params on GET /api/shift-summary.
export function fetchShiftSummaryWindows() {
  return fetchShiftJson("/api/shift-summary/windows");
}

// /shift/login is meant to be a real browser navigation (CERN's login page can't redirect
// back to a fetch) - but this backend returns 401 from /api/shift-whoami even when SSO is
// completely unconfigured, and only exposes the 503 "not configured" state on /shift/login
// itself. So before actually navigating there on a 401, do one side-effect-free manual-redirect
// fetch to see which case we're in: a 503 JSON body means unconfigured (status is readable);
// anything else - including a real redirect to CERN, which comes back as an opaque response
// with no readable status - means it's safe to navigate for real.
export async function isShiftLoginAvailable() {
  try {
    const res = await fetch("/shift/login", { credentials: "include", redirect: "manual" });
    return res.status !== 503;
  } catch {
    return true;
  }
}
