"use client";

import React from "react";
import type { InkFeatures } from "@/components/ui/ink-orbit/logic";
import { Brackets, Mark, ToolGlyph } from "@/components/ui/ink-orbit/parts";

/* A hub with four tools; one syncs at a time on its own, or whichever the
   pointer or keyboard focus is on. */
const TILES = [
  { x: 66, y: 34 },
  { x: 66, y: 116 },
  { x: 234, y: 34 },
  { x: 234, y: 116 },
];

const pathTo = (i: number) => {
  const t = TILES[i];
  const dir = t.x < 150 ? -1 : 1;
  return `M${150 + dir * 17},75 H${150 + dir * 42} V${t.y} H${t.x - dir * 15}`;
};

export function IntegrationsCard({ copy, reduced }: { copy: InkFeatures["integrations"]; reduced: boolean }) {
  const [hover, setHover] = React.useState(-1);
  const [auto, setAuto] = React.useState(0);
  React.useEffect(() => {
    if (reduced || hover >= 0) return;
    const t = setInterval(() => setAuto((a) => (a + 1) % 4), 1700);
    return () => clearInterval(t);
  }, [reduced, hover]);
  const on = hover >= 0 ? hover : reduced ? -1 : auto;

  return (
    <div className="ib-frame ib-frame-hover">
      <Brackets />
      <div className="ib-card">
        <svg className="ib-diagram" viewBox="0 0 300 150" role="group" aria-label="Integrations">
          {TILES.map((_, i) => (
            <path key={i} d={pathTo(i)} className={`ib-flow${on === i ? " ib-flow-on" : ""}`} />
          ))}
          {!reduced && on >= 0 && (
            <circle key={on} r="2.2" className="ib-pkt">
              <animateMotion dur="1.1s" repeatCount="indefinite" path={pathTo(on)} />
            </circle>
          )}
          <g transform="translate(133,58)">
            <rect width="34" height="34" rx="7" className="ib-node" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,.08))" }} />
            <g transform="translate(8,8)" style={{ color: "var(--ib-ink)" }}>
              <Mark size={18} />
            </g>
          </g>
          {TILES.map((t, i) => (
            <g
              key={i}
              className={`ib-tool${on === i ? " ib-tool-on" : ""}`}
              tabIndex={0}
              role="img"
              aria-label={copy.tools[i] ?? "Tool"}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(-1)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(-1)}
            >
              <rect x={t.x - 15} y={t.y - 15} width="30" height="30" rx="6" className="ib-node" />
              <g transform={`translate(${t.x},${t.y})`} style={{ color: "var(--ib-ink)" }}>
                <ToolGlyph index={i} />
              </g>
              <text
                x={t.x}
                y={t.y + (t.y < 75 ? -21 : 28)}
                textAnchor="middle"
                fontSize="8"
                fill="var(--ib-muted)"
                fontFamily="var(--ib-sans)"
                opacity={on === i ? 1 : 0}
                style={{ transition: "opacity .25s" }}
              >
                {copy.tools[i] ?? ""}
              </text>
            </g>
          ))}
          <text x="150" y="112" textAnchor="middle" fontSize="7" fill="var(--ib-faint)" fontFamily="var(--ib-mono)">
            {on >= 0 ? `syncing · ${(copy.tools[on] ?? "").toLowerCase()}` : "4 connected"}
          </text>
        </svg>
        <div style={{ marginTop: "auto" }}>
          <h3>{copy.title}</h3>
          <p>{copy.description}</p>
        </div>
      </div>
    </div>
  );
}
