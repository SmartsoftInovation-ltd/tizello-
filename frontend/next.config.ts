import type { NextConfig } from "next";

import { SERVER_ACTION_BODY_LIMIT } from "./src/lib/upload-limits";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /*
       * A file is uploaded THROUGH a Server Action (`lib/actions/upload-actions.ts`
       * — the session cookies are httpOnly on this origin, so the browser
       * cannot post to the API directly). Next caps an action body at 1 MB by
       * default and rejects the request rather than returning an error from
       * it, so anything larger threw past the drawer and rendered the
       * segment's `error.tsx`. Imported rather than typed twice: the reason
       * this number is what it is lives in `lib/upload-limits.ts`.
       */
      bodySizeLimit: SERVER_ACTION_BODY_LIMIT,
    },
  },

  /*
   * Development only. Next blocks cross-origin requests to dev assets, and the
   * failure is silent: the page renders but the client bundle never loads, so
   * nothing hydrates. Anyone opening the dev server from another device on the
   * LAN — a phone, a second machine — needs their host listed here.
   */
  allowedDevOrigins: ["192.168.1.193"],

  /*
   * Development only — prints every server-side `fetch` under the request that
   * made it, with the full URL, status and duration. This is the only place
   * the backend calls are visible: pages are Server Components, so the API is
   * called from this server, and the browser's Network tab shows just one
   * `?_rsc=` request per navigation. `fullUrl` keeps the query string, so
   * `projects?limit=100&status=…` is distinguishable from the unfiltered list.
   */
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  images: {
    /*
     * Next 16 requires an explicit allowlist; anything outside it is coerced to
     * the nearest entry. Listing only 100 means every <Image> — including ones
     * that omit the prop and would otherwise default to 75 — is served at full
     * quality, which is the house rule.
     *
     * AVIF/WebP are what keep the byte cost of that reasonable.
     */
    qualities: [100],
    formats: ["image/avif", "image/webp"],

    /*
     * Remote hosts must be listed before next/image will optimise them.
     * Add entries here rather than reaching for `unoptimized`.
     * e.g. { protocol: "https", hostname: "images.example.com" }
     *
     * UPLOADED FILES ARE THE ONE EXCEPTION, and cannot be listed.
     *
     * They are served by the API's `/static` mount, which in development is
     * `localhost:5001` — and Next's optimiser rejects loopback and private
     * hosts outright as an SSRF guard, so a `remotePatterns` entry for one is
     * accepted by the config and then refused at request time with `"url"
     * parameter is not allowed`. Verified: an entry for `probe.example.com`
     * matches (and fails on the unreachable host), the identical entry for
     * `127.0.0.1:5001` does not match at all.
     *
     * `FilePreview` therefore renders attachments `unoptimized`, which works
     * in every environment rather than only where the API has a public
     * hostname. `fill` + `sizes` still give it the layout box, so there is no
     * shift; what is given up is the resize and the AVIF/WebP re-encode.
     */
    remotePatterns: [],
  },
};

export default nextConfig;
