import { Queue } from 'bullmq';
import { connection } from '../config/redis.js';

// Producer side of the email queue. Services import the enqueue helpers
// below — never `new Queue(...)` of their own, and never send an email
// inline. An invitation POST must return as soon as the row is written; SMTP
// latency and retries belong on this queue, not in the request.

const EMAIL_QUEUE_NAME = 'email-queue';

// BullMQ namespaces every key as <prefix>:<queue>:<id>, and the default prefix
// is 'bull'. 'email-queue' is a name any project would pick, so on a shared
// Redis (one localhost:6379, db 0, several apps) two unrelated services end up
// on the same keyspace: this worker then pulls another app's jobs, fails them
// on an unknown job name, and burns their retries. The prefix is what keeps
// the queues apart — it must match in email.worker.js or the worker listens to
// a queue nobody produces to.
const EMAIL_QUEUE_PREFIX = 'tizello';

const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection,
  prefix: EMAIL_QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 2000,
  },
});

// Queues a workspace invitation email. The invitation row must already be
// committed before this is called: the worker reads it back by id, so
// enqueueing first would race a job against its own data.
const enqueueInvitationEmail = ({ invitationId, token }) =>
  emailQueue.add('send-invitation', { invitationId, token });

// Queues a six-digit registration-verification code.
//
// The RAW code travels in the payload, and it has to: only its bcrypt hash is
// stored, so the worker cannot reconstruct it from the row no matter what it
// reads back. The same is true of the login code and the reset token below —
// each is passed once, at mint time, and never again.
const enqueueRegistrationCodeEmail = ({ userId, code }) =>
  emailQueue.add('send-registration-code', { userId, code });

// Queues a six-digit sign-in code. The code itself is a credential: it must not
// be logged, and the queue payload is the only place outside the email that
// holds it in the clear.
const enqueueLoginCodeEmail = ({ userId, code }) =>
  emailQueue.add('send-login-code', { userId, code });

// Queues a password-reset link.
const enqueuePasswordResetEmail = ({ userId, token }) =>
  emailQueue.add('send-reset', { userId, token });

// Queues "you were assigned a task" for one recipient.
//
// The task is passed by ID and read back by the worker, like the invitation
// above — its title may have changed by the time the job runs, and the email
// should say what the task is called when it lands, not when it was queued.
// The in-app notification makes the opposite choice on purpose (it is a record
// of what someone was told); the two differ because an email is read once and
// a notification list is read for weeks.
//
// `attempts: 3`, not the queue's default 5. Nobody is blocked on this: a
// missed assignment email is a courtesy lost, while five exponential retries
// per recipient on a bulk assignment of forty tasks is a real load spike.
const enqueueAssignmentEmail = ({ userId, taskId, actorName, sprintName, projectName }) =>
  emailQueue.add(
    'send-assignment',
    { userId, taskId, actorName, sprintName, projectName },
    { attempts: 3 }
  );

export {
  emailQueue,
  EMAIL_QUEUE_NAME,
  EMAIL_QUEUE_PREFIX,
  enqueueInvitationEmail,
  enqueueRegistrationCodeEmail,
  enqueueLoginCodeEmail,
  enqueuePasswordResetEmail,
  enqueueAssignmentEmail,
};
export default emailQueue;
