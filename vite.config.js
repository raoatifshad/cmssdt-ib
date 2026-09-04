import { defineConfig, loadEnv, transformWithOxc } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Shift console lives on the same FastAPI backend as the chat widget. Unlike the chat
  // widget's cross-origin absolute-URL calls, these need a same-origin proxy so the
  // CERN SSO session cookie set by /shift/auth/callback is actually sent back.
  const shiftBackend = env.VITE_SHIFT_API_BASE || env.VITE_CMSSDT_API_BASE || "http://localhost:8000";

  return {
    plugins: [
      {
        name: "treat-js-files-as-jsx",
        enforce: "pre",
        async transform(code, id) {
          if (!id.match(/src\/.*\.js$/)) return null;

          const result = await transformWithOxc(code, id, {
            lang: "jsx",
          });

          return {
            code: result.code,
            map: result.map,
            moduleType: "js",
          };
        },
      },
      react(),
    ],

    optimizeDeps: {
      rolldownOptions: {
        moduleTypes: {
          ".js": "jsx",
        },
      },
    },

    base: "./",

    server: {
      host: "0.0.0.0",
      port: 5173,
      // Bare "/shift" is intentionally NOT proxied - it must stay a client-side route
      // owned by the React router (ShiftConsolePage), since the backend's login
      // callback redirects to /shift and that needs to land on our own page.
      proxy: {
        "/shift/login": { target: shiftBackend, changeOrigin: true },
        "/shift/auth/callback": { target: shiftBackend, changeOrigin: true },
        "/shift/logout": { target: shiftBackend, changeOrigin: true },
        // Dev-only CERN SSO bypass (?username=...) for local testing without real SSO
        // client credentials. Dev server only - intentionally not mirrored in `preview`
        // below, since that block models a production deployment.
        "/shift/dev-login": { target: shiftBackend, changeOrigin: true },
        "/api/shift-whoami": { target: shiftBackend, changeOrigin: true },
        "/api/shift-summary": { target: shiftBackend, changeOrigin: true },
        "/api/alerts/status": { target: shiftBackend, changeOrigin: true },
      },
    },

    // Only takes effect if production is served via `vite preview` rather than a static
    // Nginx/CDN host. If it's a static host, mirror the six rules above (never bare
    // "/shift") in that host's own reverse-proxy config - it can't read this file.
    preview: {
      proxy: {
        "/shift/login": { target: shiftBackend, changeOrigin: true },
        "/shift/auth/callback": { target: shiftBackend, changeOrigin: true },
        "/shift/logout": { target: shiftBackend, changeOrigin: true },
        "/api/shift-whoami": { target: shiftBackend, changeOrigin: true },
        "/api/shift-summary": { target: shiftBackend, changeOrigin: true },
        "/api/alerts/status": { target: shiftBackend, changeOrigin: true },
      },
    },
  };
});