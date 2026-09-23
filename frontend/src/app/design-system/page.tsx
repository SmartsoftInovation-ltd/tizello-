import Link from "next/link";
import { BoardPreview } from "@/components/design-system/board-preview";
import { Media } from "@/components/design-system/media";
import {
  BrandPalette,
  NeutralPalettes,
  StatusPalette,
} from "@/components/design-system/palette";
import { Buttons, RadiusAndElevation } from "@/components/design-system/surfaces";
import { TypeScale } from "@/components/design-system/typography";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Design-system reference page, at `/design-system`. Every value below is a
 * token — nothing is hard-coded. It used to sit on `/`, which meant starting
 * the server landed on it instead of the app; `/` now routes to sign-in/home
 * and this page stays as a reference. Delete the route once it stops earning
 * its keep.
 *
 * A Server Component: ThemeToggle is the only interactive part, and it is its
 * own client leaf.
 */
export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-14 px-6 py-14">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="inline-flex items-center rounded-xs bg-brand-100 px-2 py-0.5 text-2xs font-semibold tracking-widest text-brand-800 uppercase">
            Design system
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/board/sprint"
              className="text-xs font-semibold text-text-brand transition-colors duration-100 ease-standard hover:text-brand-600"
            >
              Open the board &rarr;
            </Link>
            <ThemeToggle />
          </div>
        </div>
        <h1 className="text-4xl font-semibold">Tizello</h1>
        <p className="max-w-xl text-base text-text-muted">
          Trello&rsquo;s structure and greys, reduced to a minimal token set and
          re-branded around fresh mint. Inter stands in for Atlassian&rsquo;s
          proprietary Charlie typeface. Every colour below is a semantic token,
          so the whole page re-themes from one attribute on &lt;html&gt;.
        </p>
      </header>

      <TypeScale />
      <BrandPalette />
      <NeutralPalettes />
      <StatusPalette />
      <Buttons />
      <RadiusAndElevation />
      <Media />
      <BoardPreview />
    </main>
  );
}
