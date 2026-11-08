/* The flow diagram's right side: a stack of report sheets, the front one
   printed with the live report number. A new sheet animates in each time the
   number ticks (keyed on it). */
const BARS = [18, 26, 14, 30, 22, 34];

export function FlowReports({ reports, onHover }: { reports: number; onHover: (on: boolean) => void }) {
  return (
    <g onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      {[2, 1, 0].map((k) => (
        <g key={reports - k} transform={`translate(${450 + k * 12},${40 - k * 10})`} opacity={1 - k * 0.25}>
          <g className={`ib-sheet${k === 0 ? " ib-sheet-new" : ""}`}>
            <rect width="138" height="102" rx="3" fill="var(--ib-raise)" stroke="var(--ib-line-strong)" />
            {k === 0 && (
              <>
                <text x="10" y="16" fontSize="7" fill="var(--ib-muted)" fontFamily="var(--ib-mono)">
                  {`REPORT #${reports}`}
                </text>
                <rect x="10" y="24" width="64" height="5" rx="1" fill="var(--ib-ink)" opacity=".75" />
                <rect x="10" y="33" width="92" height="3" rx="1" fill="var(--ib-line-strong)" />
                <rect x="10" y="39" width="80" height="3" rx="1" fill="var(--ib-line-strong)" />
                {BARS.map((h, j) => (
                  <rect key={j} x={12 + j * 13} y={92 - h} width="8" height={h} fill="var(--ib-ink)" opacity={0.25 + j * 0.12} />
                ))}
                <path d="M92 64h34M92 72h28M92 80h32" stroke="var(--ib-line-strong)" strokeWidth="2.5" />
              </>
            )}
          </g>
        </g>
      ))}
    </g>
  );
}
