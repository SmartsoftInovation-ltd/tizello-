/**
 * Limits the chat UI shares with the API.
 *
 * `CONTENT_MAX` mirrors `chat.validator.js` — the server is the authority and
 * refuses anything longer with a `VALIDATION_ERROR`; this copy exists so the
 * composer and the edit dialog can stop a person before they lose a paragraph
 * to a rejection.
 *
 * Its own module because both a client component and a server one may want it,
 * and everything else in the chat lib chain reaches the API.
 */
export const CONTENT_MAX = 4000;
