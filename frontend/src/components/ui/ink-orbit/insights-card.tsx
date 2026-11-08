"use client";

import React from "react";
import { chartPaths, clamp, nearestIndex, type InkFeatures } from "@/components/ui/ink-orbit/logic";
import { Brackets, useInView } from "@/components/ui/ink-orbit/parts";

/* A forecast chart you can scrub: the line draws in once on screen, the
   pointer picks the nearest point, and points past `forecastFrom` read as
   predictions. */
const W = 300;
const H = 130;

export function InsightsCard({ copy, uid, reduced }: { copy: InkFeatures["insights"]; uid: string; reduced: boolean }) {
  const [ref, inView] = useInView(0.3);
  const [hover, setHover] = React.useState(-1);
  const vals = copy.values.length > 1 ? copy.values : [1, 2];
  const { line, area, points } = chartPaths(vals, W, H, 14);
  const split = clamp(copy.forecastFrom, 1, vals.length - 1);
  const fill = `${uid}area`;
  const last = points[points.length - 1];
  const i = hover >= 0 ? hover : points.length - 1;
  const p = points[i];
  const pct = Math.round(((vals[i] - vals[0]) / (vals[0] || 1)) * 100);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(nearestIndex(points.map((q) => q[0]), ((e.clientX - r.left) / r.width) * W));
  };

  return (
    <div className="ib-frame ib-frame-hover" ref={ref as never} data-in={inView}>
      <Brackets />
      <div className="ib-card">
        <svg
          className="ib-diagram ib-chart"
          viewBox={`0 0 ${W} ${H + 6}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(-1)}
          role="img"
          aria-label={`${copy.title} chart`}
        >
          <defs>
            <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--ib-ink)" stopOpacity=".12" />
              <stop offset="1" stopColor="var(--ib-ink)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1="14" x2={W - 14} y1={H * g} y2={H * g} stroke="var(--ib-line)" />
          ))}
          <path d={area} fill={`url(#${fill})`} />
          <path d={line} fill="none" stroke="var(--ib-ink)" strokeWidth="1.4" pathLength={1} className="ib-line-draw" opacity=".85" />
          <line x1={points[split][0]} x2={points[split][0]} y1="10" y2={H - 14} stroke="var(--ib-line-strong)" strokeDasharray="2 3" />
          <text x={points[split][0] - 4} y={H - 18} textAnchor="end" fontSize="7" fill="var(--ib-faint)" fontFamily="var(--ib-mono)">
            FORECAST
          </text>
          {hover >= 0 && <line x1={p[0]} x2={p[0]} y1="8" y2={H - 14} stroke="var(--ib-ink)" strokeOpacity=".35" />}
          {!reduced && hover < 0 && <circle cx={last[0]} cy={last[1]} r="7" fill="var(--ib-ink)" opacity=".15" className="ib-glow" />}
          <circle cx={p[0]} cy={p[1]} r="3.2" fill="var(--ib-raise)" stroke="var(--ib-ink)" strokeWidth="1.5" />
          <g transform={`translate(${clamp(p[0], 40, W - 40)},${p[1] < 34 ? p[1] + 22 : p[1] - 12})`}>
            <rect x="-30" y="-11" width="60" height="15" rx="2" fill="var(--ib-inv)" />
            <text x="0" y="-1" textAnchor="middle" fontSize="7.5" fill="var(--ib-inv-ink)" fontFamily="var(--ib-mono)">
              {`${i >= split ? "pred " : `wk ${i + 1} `}${pct >= 0 ? "+" : ""}${pct}%`}
            </text>
          </g>
        </svg>
        <div style={{ marginTop: "auto" }}>
          <h3>{copy.title}</h3>
          <p>{copy.description}</p>
        </div>
      </div>
    </div>
  );
}
