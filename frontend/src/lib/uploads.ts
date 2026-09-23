/*
 * Where an uploaded file is READ from.
 *
 * The API serves the upload directory twice, and this module is the frontend's
 * side of that decision (`backend/docs/api/upload.md` §Two read paths):
 *
 * - `GET /api/v1/uploads/:name` — behind `authGuard`, session-scoped.
 * - `GET /static/:name` — `express.static`, PUBLIC. This is the one used here.
 *
 * PUBLIC IS THE POINT AND ALSO THE COST. A `<img src>` cannot carry the app's
 * session: the cookies are httpOnly on the Next origin, so a browser request
 * to the API is cross-origin and arrives with nothing. The authenticated route
 * therefore needed a same-origin proxy in front of it, which meant every byte
 * of every attachment travelled through this process. The static mount removes
 * that hop — and makes any file readable by anyone holding its URL. The names
 * are UUIDs, so they are unguessable, but a leaked URL is permanent access.
 *
 * `NEXT_PUBLIC_` because the browser is what resolves these — unlike
 * `API_BASE_URL`, which is server-only precisely because the browser never
 * talks to the API directly. It still does not: it talks to a static file
 * server that happens to share the API's origin.
 */

/** Exactly the shape `shared/middlewares/upload.js` generates: a UUID and an allowlisted extension. */
export const STORED_NAME = /^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/i;

/** Rendered inline as text. Everything else is offered as a file, not as a preview. */
const TEXT_TYPES = new Set(["text/plain", "text/csv", "application/json"]);

/**
 * The spreadsheet `SheetPreview` can actually open.
 *
 * `.xlsx` only. The allowlist in `shared/middlewares/upload.js` also accepts
 * `application/vnd.ms-excel` — legacy `.xls`, the pre-2007 BIFF binary — and
 * `exceljs` cannot read it. The alternative that can is SheetJS, whose npm
 * release is three years stale and carries two unfixed advisories, on a code
 * path that would be parsing files strangers upload. So `.xls` stays a
 * download and says so, which is a smaller lie than a viewer that fails on it.
 */
const SHEET_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const LEGACY_SHEET_TYPE = "application/vnd.ms-excel";

/**
 * How much of a text file is read into the page.
 *
 * A cap rather than the whole file: this runs during the project page's render,
 * and a 10 MB CSV pasted into the HTML is a page nobody can load. Anything
 * longer is truncated and says so — the link beside it is the full copy.
 */
const MAX_TEXT_PREVIEW_BYTES = 16 * 1024;

/** Trailing slash trimmed so `uploadUrl` can join with exactly one. */
const BASE = (process.env.NEXT_PUBLIC_UPLOADS_URL ?? "").replace(/\/+$/, "");

export function isTextPreviewable(mime: string): boolean {
  return TEXT_TYPES.has(mime);
}

export function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

/** Chat's "+" button sends these; `ui/app-image.tsx` cannot render one. */
export function isVideo(mime: string): boolean {
  return mime.startsWith("video/");
}

export function isPdf(mime: string): boolean {
  return mime === "application/pdf";
}

export function isSheet(mime: string): boolean {
  return mime === SHEET_TYPE;
}

/** A spreadsheet that cannot be previewed — the row says why rather than showing nothing. */
export function isLegacySheet(mime: string): boolean {
  return mime === LEGACY_SHEET_TYPE;
}

/** Documents get the full width of the grid; an image is a tile. */
export function isWidePreview(mime: string): boolean {
  return isPdf(mime) || isSheet(mime) || isTextPreviewable(mime);
}

/**
 * The public URL of a stored file, or `null` for anything this server did not
 * write.
 *
 * The name is checked rather than trusted even though it came from the API: it
 * is interpolated into a URL, and a stored value that does not match the shape
 * the upload middleware generates is a value that was tampered with somewhere
 * between here and the disk.
 */
export function uploadUrl(storedName: string): string | null {
  if (!BASE || !STORED_NAME.test(storedName)) return null;

  return `${BASE}/${storedName}`;
}

export type TextPreview = { body: string; truncated: boolean };

/**
 * The first `MAX_TEXT_PREVIEW_BYTES` of a text file, or `null` if it could not
 * be read.
 *
 * Fetched on the server so the preview is themed, wrapped and part of the
 * page rather than an iframe. No cookies: the static mount takes none, which
 * is what makes this a plain `fetch` rather than the cookie-forwarding dance
 * every other call in this app performs.
 */
export async function readTextPreview(storedName: string): Promise<TextPreview | null> {
  const url = uploadUrl(storedName);
  if (!url) return null;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const truncated = buffer.byteLength > MAX_TEXT_PREVIEW_BYTES;

    return {
      body: new TextDecoder().decode(buffer.slice(0, MAX_TEXT_PREVIEW_BYTES)),
      truncated,
    };
  } catch {
    /* The API is unreachable. A missing preview is not worth a 500 on a page
       whose other twenty fields are fine. */
    return null;
  }
}
