/*
 * Resolves the project's `@/*` path alias for `node --test`.
 *
 * Node has no knowledge of tsconfig `paths`, so a source module that imports
 * `@/lib/sprint-dates` as a VALUE fails to load. Test files themselves use
 * relative imports; this hook exists only for the aliases already inside the
 * modules under test. Nothing else is touched.
 */
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..", "src");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const target = path.join(SRC, specifier.slice(2));
      return { url: pathToFileURL(`${target}.ts`).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
