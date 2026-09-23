/**
 * The `io` singleton, and nothing else.
 *
 * WHY THIS IS NOT IN `index.js`. `index.js` registers the namespaces, so it
 * imports `chat.namespace.js`, which imports `emit.js` to broadcast — and if
 * `emit.js` read the singleton from `index.js` that is an import cycle. ESM
 * tolerates cycles by handing one side a partially-initialised module, which
 * here would mean `getIo` resolving to `undefined` depending on which file the
 * process happened to load first: a broadcast that silently does nothing, in
 * production, intermittently.
 *
 * A two-function state module breaks it. Everything imports this; this imports
 * nothing.
 *
 * See .claude/plan/chat.md §4.1
 */

let io = null;

const setIo = (instance) => {
  io = instance;
};

/** Null until `initSocket` runs — see `emit.js` on why that is not an error. */
const getIo = () => io;

export { setIo, getIo };
export default { setIo, getIo };
