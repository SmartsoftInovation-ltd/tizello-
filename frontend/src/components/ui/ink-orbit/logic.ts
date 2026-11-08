/*
 * Pure helpers and default copy for `InkOrbitFeatures` (../ink-orbit-features.tsx).
 * No React here, so the maths can be read and tested on its own.
 */
export type InkFeatureCopy = { title: string; description: string };
export type InkFeatures = {
  tag: string;
  /** `*word*` sets a word in the muted tone; `\n` breaks the line. */
  title: string;
  collaboration: InkFeatureCopy;
  reports: InkFeatureCopy;
  integrations: InkFeatureCopy & { tools: string[] };
  insights: InkFeatureCopy & { values: number[]; forecastFrom: number };
};

export function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

/** Smooth line + closed area through values, inside a w×h box. */
export function chartPaths(values: number[], w: number, h: number, pad: number) {
  const n = values.length;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map(
    (v, i) =>
      [pad + (n < 2 ? 0 : (i / (n - 1)) * (w - pad * 2)), h - pad - ((v - lo) / span) * (h - pad * 2)] as [number, number],
  );
  let line = "";
  pts.forEach(([x, y], i) => {
    if (i === 0) {
      line = `M${x.toFixed(1)},${y.toFixed(1)}`;
      return;
    }
    const [px, py] = pts[i - 1];
    const cx = ((px + x) / 2).toFixed(1);
    line += ` C${cx},${py.toFixed(1)} ${cx},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = n ? `${line} L${pts[n - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z` : "";
  return { line, area, points: pts };
}

export function nearestIndex(xs: number[], x: number): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
  return best;
}

/**
 * "Smart *Workflow*\nAutomation" → lines of { text, muted } runs. A literal
 * backslash-n counts too, since that is what "\n" becomes in a JSX attribute.
 */
export function parseTitle(s: string): { text: string; muted: boolean }[][] {
  return s.split(/\n|\\n/).map((line) => {
    const out: { text: string; muted: boolean }[] = [];
    line.split("*").forEach((text, i) => {
      if (text) out.push({ text, muted: i % 2 === 1 });
    });
    return out;
  });
}

export const D_FEATURES: InkFeatures = {
  tag: "Features",
  title: "Smart *Workflow*\nAutomation",
  collaboration: {
    title: "Real-Time Collaboration",
    description: "Work together in real time, share updates, track changes, and stay aligned without switching tools.",
  },
  reports: {
    title: "Auto-generated reports",
    description: "Get clean, structured reports generated from your data — no formatting, manual writing, or editing required.",
  },
  integrations: {
    title: "Integrations Hub",
    description: "Connect all your tools — Slack, Google Workspace, CRMs, databases — into one unified AI system.",
    tools: ["Sheets", "Drive", "Docs", "Search"],
  },
  insights: {
    title: "Predictive Insights",
    description: "AI analyzes your data and delivers real-time predictions you can act on immediately.",
    values: [22, 26, 24, 31, 29, 36, 34, 41, 39, 47, 52, 58],
    forecastFrom: 8,
  },
};
