import { useEffect, useState } from "react";
import { fetchReleaseExplorerFailing } from "./shiftApi";

// Fetches GET /api/release-explorer/failing for one exact (tag, archs). Its own file
// (not inlined in TestFailuresPanel.js) purely so that component module only exports the
// one component - a second, non-component export there defeats React Fast Refresh's
// hot-patching on every edit (falls back to a full remount instead). ReleaseExplorerPanel
// calls this once per side, so Compare mode can hand both results down and let each
// side's table cross-reference the other's (see TestFailuresPanel's Legend/tint column).
export function useFailingData(tag, archs) {
  const [state, setState] = useState({ data: null, loading: true, error: false });
  const archKey = (archs || []).join(",");

  useEffect(() => {
    if (!tag) {
      setState({ data: null, loading: false, error: false });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    fetchReleaseExplorerFailing(tag, archs)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, loading: false, error: true });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag, archKey]);

  return state;
}
