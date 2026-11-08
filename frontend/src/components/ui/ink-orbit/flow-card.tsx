"use client";

import React from "react";
import { FlowReports } from "@/components/ui/ink-orbit/flow-reports";
import { FlowTeam } from "@/components/ui/ink-orbit/flow-team";
import type { InkFeatures } from "@/components/ui/ink-orbit/logic";
import { Brackets, Mark } from "@/components/ui/ink-orbit/parts";

/* The wide card: the team's edits flow through the brand hub into a stack of
   reports that keeps printing. Hovering either side lights its connectors. */
const L1 = "M117,67 C196,67 210,100 262,100";
const L2 = "M117,73 C186,73 206,120 262,120";
const R1 = "M378,100 C412,100 418,86 450,86";
const R2 = "M378,120 C412,120 418,134 450,134";
const RAY_ANGLES = [-62, -38, -14, 14, 38, 62];

const ray = (a: number) => {
  const at = (deg: number) => [320 + Math.sin((deg * Math.PI) / 180) * 260, 110 - Math.cos((deg * Math.PI) / 180) * 260];
  const [x1, y1] = at(a);
  const [x2, y2] = at(a + 7);
  return `M320,110 L${x1},${y1} L${x2},${y2}Z`;
};

type Props = { brand: string; features: InkFeatures; uid: string; reduced: boolean; inView: boolean };

export function FlowCard({ brand, features, uid, reduced, inView }: Props) {
  const [reports, setReports] = React.useState(128);
  const [side, setSide] = React.useState<"" | "left" | "right">("");
  React.useEffect(() => {
    if (reduced || !inView) return;
    const t = setInterval(() => setReports((n) => n + 1), 2800);
    return () => clearInterval(t);
  }, [reduced, inView]);

  const chip = brand.split(" ")[0].toUpperCase();
  const chipLong = chip.length * 6.7 > 58;
  const flow = (on: boolean, dashed: boolean) => `ib-flow${on ? " ib-flow-on" : ""}${dashed ? " ib-dash" : ""}`;

  return (
    <div className="ib-frame ib-frame-hover ib-wide">
      <Brackets />
      <div className="ib-card" style={{ padding: 0, overflow: "hidden" }}>
        <svg className="ib-diagram" viewBox="0 0 640 178" role="img" aria-label={`Your team's edits flow through ${brand} into finished reports`}>
          <defs>
            <radialGradient id={`${uid}glow`} cx="320" cy="110" r="190" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--ib-raise)" stopOpacity="1" />
              <stop offset="1" stopColor="var(--ib-raise)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${uid}rays`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--ib-line-strong)" stopOpacity=".55" />
              <stop offset="1" stopColor="var(--ib-line-strong)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="640" height="178" fill={`url(#${uid}glow)`} />
          {RAY_ANGLES.map((a) => (
            <path key={a} d={ray(a)} fill={`url(#${uid}rays)`} opacity=".5" />
          ))}

          <FlowTeam uid={uid} onHover={(on) => setSide(on ? "left" : "")} />

          {[L1, L2].map((d, i) => (
            <path key={d} d={d} className={flow(side === "left", i > 0)} />
          ))}
          {[R1, R2].map((d, i) => (
            <path key={d} d={d} className={flow(side === "right", i > 0)} />
          ))}
          {!reduced &&
            [L1, L2, R1, R2].map((d, i) => (
              <circle key={`p${i}`} r="2.2" className="ib-pkt">
                <animateMotion dur={`${2.2 + (i % 2) * 0.6}s`} begin={`${i * 0.35}s`} repeatCount="indefinite" path={d} />
              </circle>
            ))}

          <g transform="translate(262,88)">
            <rect x="-4" y="-4" width="124" height="52" rx="8" fill="none" stroke="var(--ib-line)" className={reduced ? undefined : "ib-glow"} />
            <rect width="116" height="44" rx="6" className="ib-node" style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,.08))" }} />
            <g transform="translate(13,14)" style={{ color: "var(--ib-ink)" }}>
              <Mark size={16} />
            </g>
            <text
              x="36"
              y="26"
              fontSize="8.5"
              letterSpacing="1.4"
              fontWeight="600"
              fill="var(--ib-soft)"
              fontFamily="var(--ib-sans)"
              textLength={chipLong ? 58 : undefined}
              lengthAdjust={chipLong ? "spacingAndGlyphs" : undefined}
            >
              {chip}
            </text>
            <path d="M100 18l4 4-4 4" fill="none" stroke="var(--ib-muted)" strokeWidth="1.3" />
          </g>

          <FlowReports reports={reports} onHover={(on) => setSide(on ? "right" : "")} />
        </svg>
        <div className="ib-wide-copy" style={{ padding: "0 22px 20px" }}>
          <div>
            <h3>{features.collaboration.title}</h3>
            <p>{features.collaboration.description}</p>
          </div>
          <div>
            <h3>{features.reports.title}</h3>
            <p>{features.reports.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
