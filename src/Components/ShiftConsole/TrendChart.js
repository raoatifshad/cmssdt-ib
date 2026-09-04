import React from "react";
import { theme } from "./theme";

// Hand-rolled SVG line chart - no charting dependency needed for 5 short series over a
// few dozen points. Mirrors the "IB Health Trend" pattern (multi-series line chart,
// shared axis, legend) from the dashboard reference the user pointed to.
const WIDTH = 760;
const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 32, left: 34 };

const plotW = WIDTH - PAD.left - PAD.right;
const plotH = HEIGHT - PAD.top - PAD.bottom;

function buildPath(values, maxY, n) {
  return values
    .map((v, i) => {
      const x = PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
      const y = PAD.top + plotH - (maxY === 0 ? 0 : (v / maxY) * plotH);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const TrendChart = ({ points, series }) => {
  const n = points.length;
  const maxRaw = Math.max(1, ...points.flatMap((p) => series.map((s) => p[s.key] || 0)));
  const maxY = Math.ceil(maxRaw * 1.15);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));

  // Thin out x-axis labels so they don't overlap when the range spans many builds.
  const labelStep = Math.max(1, Math.ceil(n / 7));

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
        {series.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.76rem", color: theme.textSecondary }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, display: "inline-block" }} />
            {s.label}
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {yTicks.map((t, i) => {
          const y = PAD.top + plotH - (i / (yTicks.length - 1)) * plotH;
          return (
            <g key={i}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} stroke={theme.border} strokeWidth={1} strokeDasharray="3 4" />
              <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize={9} fill={theme.textMuted}>
                {t}
              </text>
            </g>
          );
        })}

        {points.map((p, i) => {
          if (i % labelStep !== 0 && i !== n - 1) return null;
          const x = PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
          return (
            <text key={i} x={x} y={HEIGHT - 8} textAnchor="middle" fontSize={9} fill={theme.textMuted}>
              {p.label}
            </text>
          );
        })}

        {series.map((s) => (
          <path key={s.key} d={buildPath(points.map((p) => p[s.key] || 0), maxY, n)} fill="none" stroke={s.color} strokeWidth={2} />
        ))}

        {series.map((s) =>
          points.map((p, i) => {
            const x = PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
            const y = PAD.top + plotH - (maxY === 0 ? 0 : ((p[s.key] || 0) / maxY) * plotH);
            return <circle key={`${s.key}-${i}`} cx={x} cy={y} r={2.5} fill={s.color} />;
          })
        )}
      </svg>
    </div>
  );
};

export default TrendChart;
