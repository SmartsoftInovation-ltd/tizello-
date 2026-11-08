"use client";

import React from "react";
import { FlowCard } from "@/components/ui/ink-orbit/flow-card";
import { InsightsCard } from "@/components/ui/ink-orbit/insights-card";
import { IntegrationsCard } from "@/components/ui/ink-orbit/integrations-card";
import { D_FEATURES, type InkFeatureCopy, type InkFeatures } from "@/components/ui/ink-orbit/logic";
import { Title, useInView } from "@/components/ui/ink-orbit/parts";
import { IB_CSS } from "@/components/ui/ink-orbit/styles";

export type { InkFeatureCopy, InkFeatures } from "@/components/ui/ink-orbit/logic";

/*
 * A features section: a hatched page and a bento of three live diagrams — the
 * team's edits flowing through a hub into a stack of reports that keeps
 * printing, an integrations hub that syncs one tool at a time, and a forecast
 * chart you can scrub. No dependencies, no assets.
 *
 * Adapted from the ink-orbit template and SPLIT across `ink-orbit/` to meet
 * this repo's 150-line cap; behaviour and markup are unchanged. Additions:
 * `tone="brand"` (Tizello's green, see `ink-orbit/styles.ts`) and a "T" mark.
 * Respects `prefers-reduced-motion` throughout.
 */
type Partial<T> = { [K in keyof T]?: T[K] };

export type InkOrbitFeaturesProps = {
  /** `auto` follows prefers-color-scheme. Ignored when `tone="brand"`. */
  theme?: "light" | "dark" | "auto";
  /** `brand` paints it in Tizello's green; `neutral` keeps the ink palette. */
  tone?: "neutral" | "brand";
  /** Shown on the hub chip in the flow diagram (first word, uppercased). */
  brand?: string;
  tag?: string;
  title?: string;
  collaboration?: Partial<InkFeatureCopy>;
  reports?: Partial<InkFeatureCopy>;
  integrations?: Partial<InkFeatures["integrations"]>;
  insights?: Partial<InkFeatures["insights"]>;
  className?: string;
  style?: React.CSSProperties;
};

export default function InkOrbitFeatures({
  theme = "auto",
  tone = "neutral",
  brand = "Tizello",
  tag = D_FEATURES.tag,
  title = D_FEATURES.title,
  collaboration,
  reports,
  integrations,
  insights,
  className = "",
  style,
}: InkOrbitFeaturesProps) {
  const uid = `ib${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const features: InkFeatures = {
    tag,
    title,
    collaboration: { ...D_FEATURES.collaboration, ...collaboration },
    reports: { ...D_FEATURES.reports, ...reports },
    integrations: { ...D_FEATURES.integrations, ...integrations },
    insights: { ...D_FEATURES.insights, ...insights },
  };

  const [dark, setDark] = React.useState(theme === "dark");
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setDark(theme === "auto" ? scheme.matches : theme === "dark");
      setReduced(motion.matches);
    };
    sync();
    scheme.addEventListener?.("change", sync);
    motion.addEventListener?.("change", sync);
    return () => {
      scheme.removeEventListener?.("change", sync);
      motion.removeEventListener?.("change", sync);
    };
  }, [theme]);

  const [featRef, featIn] = useInView(0.12);

  return (
    <div
      className={`ib-root ${className}`}
      /* Brand is theme-invariant, so it sets no `data-theme` — which would
         also trip the app's `dark:` variant (globals.css) for this subtree. */
      data-theme={tone === "brand" ? undefined : dark ? "dark" : "light"}
      data-tone={tone === "brand" ? "brand" : undefined}
      style={style}
    >
      <style>{IB_CSS}</style>
      <div className="ib-shell">
        <section className="ib-sec" aria-labelledby={`${uid}feat`}>
          <div className="ib-reveal" ref={featRef as never} data-in={featIn}>
            <div className="ib-head" id={`${uid}feat`}>
              {features.tag && <span className="ib-tag">{features.tag}</span>}
              <Title text={features.title} />
            </div>
            <div className="ib-bento">
              <FlowCard brand={brand} features={features} uid={uid} reduced={reduced} inView={featIn} />
              <IntegrationsCard copy={features.integrations} reduced={reduced} />
              <InsightsCard copy={features.insights} uid={uid} reduced={reduced} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
