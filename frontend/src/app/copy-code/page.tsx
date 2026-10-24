import type { Metadata } from "next";
import { AuthLogo } from "@/components/auth/auth-logo";
import { CopyCodePanel } from "@/components/auth/copy-code-panel";

export const metadata: Metadata = {
  title: "Copy your code",
  description: "Copy the one-time code from your Tizello email.",
  /* A page that shows a credential has no business in a search index. */
  robots: { index: false, follow: false },
};

/**
 * `/copy-code#<code>` — where the code emails' "Copy code" button lands.
 *
 * Public on purpose (not in `proxy.ts`'s matcher): the person arriving here is
 * usually mid-sign-up or signed out, which is why they need a code. The page
 * itself renders nothing secret on the server — the code lives only in the
 * URL fragment, read in the browser by `CopyCodePanel`.
 */
export default function CopyCodePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <AuthLogo />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <CopyCodePanel />
        </div>
      </div>
    </main>
  );
}
