/**
 * The list of every background worker, and what must be true before each one is
 * allowed to take a job.
 *
 * A worker is registered here, never started by its own file — each module
 * constructs its `Worker` with `autorun: false` and exports it, and this list is
 * what `index.js` walks. Adding a worker is one entry here plus one module; it
 * needs no change to `package.json`, which is the point: `npm run worker` runs
 * whatever is in this array.
 *
 * **`verify` is per worker, not shared.** The email worker cannot do its job
 * without SMTP and a real `CLIENT_ORIGIN`; a future worker that only touches
 * Postgres would be blocked by those checks for no reason. Each entry states its
 * own preconditions, and a failing one stops the whole process — a worker pool
 * where some workers silently did not start is worse than one that refuses to
 * boot, because the queue looks attended.
 *
 * See src/workers/index.js
 */

import config from '../config/env.js';
import emailWorker from './email.worker.js';
import { verifyMailer } from '../shared/utils/mailer.js';

/**
 * Every message the email worker sends contains a link back to the frontend, so
 * `*` — fine for CORS, and the default when CLIENT_ORIGIN is unset — produces
 * mail whose href begins with a literal asterisk instead of an origin, which no
 * mail client can open.
 *
 * A hard failure in log-only mode too: a logged link built from `*` is as
 * useless as a sent one, and discovering that in development is the point.
 */
const assertClientOrigin = () => {
  if (!config.appUrl || config.appUrl === '*') {
    throw new Error(
      'APP_URL (or CLIENT_ORIGIN) must be a real origin (e.g. http://localhost:3000) for the email worker — links are built from it.'
    );
  }
};

const workers = [
  {
    name: 'email',
    worker: emailWorker,
    /**
     * Proves the credentials by opening and authenticating one SMTP session,
     * rather than discovering they are wrong on the first real invitation.
     * Outside production with no credentials, `verifyMailer` puts the mailer in
     * log-only mode and returns instead — see mailer.js.
     */
    verify: async () => {
      assertClientOrigin();
      await verifyMailer();
    },
  },
];

/** Every registered name, for the CLI's error message. */
const workerNames = workers.map((entry) => entry.name);

export { workers, workerNames };
export default workers;
