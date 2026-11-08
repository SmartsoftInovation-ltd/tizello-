"use client";

import { Mark } from "@/components/ui/ink-orbit/parts";
import { Portrait } from "@/components/ui/ink-orbit/portrait";

/* The flow diagram's left cluster: a team of portraits around a node, each
   with a presence dot and a hover/focus tooltip naming what they are doing. */
export const TEAM = [
  { x: 58, y: 38, name: "Daniel · editing Q3 plan" },
  { x: 104, y: 22, name: "Liyana · reviewing" },
  { x: 150, y: 40, name: "Aaron · shipping v2.4" },
  { x: 46, y: 92, name: "Priya · in Insights" },
  { x: 146, y: 114, name: "Marcus · idle" },
];

export function FlowTeam({ uid, onHover }: { uid: string; onHover: (on: boolean) => void }) {
  return (
    <g onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <rect x="20" y="8" width="170" height="130" fill="transparent" />
      {TEAM.map((m, i) => (
        <line key={`l${i}`} x1={m.x} y1={m.y} x2="104" y2="70" stroke="var(--ib-line-strong)" strokeDasharray="2 3" />
      ))}
      <g transform="translate(91,57)">
        <rect width="26" height="26" rx="5" className="ib-node" />
        <g transform="translate(5,5)" style={{ color: "var(--ib-ink)" }}>
          <Mark size={16} />
        </g>
      </g>
      {TEAM.map((m, i) => (
        <g key={i} className="ib-av" tabIndex={0} role="img" aria-label={m.name}>
          <svg x={m.x - 11} y={m.y - 11} width="22" height="22" viewBox="0 0 22 22" overflow="visible">
            <clipPath id={`${uid}avc${i}`}>
              <circle cx="11" cy="11" r="11" />
            </clipPath>
            <g clipPath={`url(#${uid}avc${i})`}>
              <Portrait index={i} size={22} uid={`${uid}f`} />
            </g>
            <circle cx="11" cy="11" r="10.5" fill="none" stroke="var(--ib-paper)" strokeWidth="1.5" />
          </svg>
          <circle
            cx={m.x + 8}
            cy={m.y + 8}
            r="2.6"
            fill={i === 4 ? "var(--ib-faint)" : "var(--ib-live)"}
            stroke="var(--ib-paper)"
            className={i === 4 ? undefined : "ib-presence"}
          />
          <g className="ib-av-tip" transform={`translate(${m.x},${m.y - 18})`}>
            <rect x={-m.name.length * 2.45 - 6} y="-9" width={m.name.length * 4.9 + 12} height="14" rx="2" fill="var(--ib-inv)" />
            <text x="0" y="1" textAnchor="middle" fontSize="7.5" fill="var(--ib-inv-ink)" fontFamily="var(--ib-sans)">
              {m.name}
            </text>
          </g>
        </g>
      ))}
    </g>
  );
}
