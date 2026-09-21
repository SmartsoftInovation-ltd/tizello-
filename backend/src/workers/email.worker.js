/**
 * Consumer side of the email queue — one BullMQ worker that routes a job name
 * to the message it sends.
 *
 * The processor's contract with BullMQ is expressed entirely through its
 * return value: returning marks the job completed and it is never retried,
 * throwing schedules another attempt under the queue's exponential backoff
 * (5 attempts, src/queues/email.queue.js). So the distinction below is not
 * stylistic — a revoked or already-accepted invitation *returns*, because no
 * number of retries will make it sendable, while an SMTP failure *throws*, so
 * the mail is tried again a few seconds later.
 *
 * Job payloads carry only ids and raw secrets, never rendered mail: the row
 * is read back here so the message reflects the workspace and inviter as they
 * are at send time, not as they were when the request came in.
 *
 * See .claude/rules/logging.md, src/queues/email.queue.js
 *      and src/shared/utils/mailer.js
 */

import { Worker } from "bullmq";
import { connection } from "../config/redis.js";
import { EMAIL_QUEUE_NAME, EMAIL_QUEUE_PREFIX } from "../queues/email.queue.js";
import prisma from "../config/db.js";
import config from "../config/env.js";
import { createLogger } from "../config/logger.js";
import { sendMail } from "../shared/utils/mailer.js";
import {
  invitationEmail,
  registrationCodeEmail,
  loginCodeEmail,
  passwordResetEmail,
  taskAssignedEmail,
} from "../shared/utils/emailTemplates.js";

const log = createLogger("email-worker");

// Every job payload carries its raw credential — the verification token, the
// login code, the reset token, the invitation token — because only the hash is
// stored and the worker cannot reconstruct the link from the row. That makes
// `job.data` the one place a live secret sits at rest outside the email, so
// nothing here logs `job.data`, only the recipient.

const handlers = {
  async "send-registration-code"({ userId, code }, job) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Account deleted between enqueue and run. Return rather than throw: no
    // number of retries brings the row back, and a throw would burn all five
    // attempts on a job that can never succeed.
    if (!user) {
      log.warn(
        { userId, jobId: job.id },
        "User no longer exists, skipping registration code",
      );
      return;
    }

    // Verified through another path — an invitation, or an OAuth link. The
    // code would still work, but sending it now is noise about something
    // already done.
    if (user.emailVerifiedAt) {
      log.warn({ userId, jobId: job.id }, "User already verified, skipping");
      return;
    }

    const mail = registrationCodeEmail({
      code,
      expiresInMinutes: config.auth.registrationCodeTtlMinutes,
    });

    // Recipient only. The code is the credential — the root logger redacts a
    // field named `token`, and that is a safety net, not permission to hand it
    // one.
    await sendMail({ to: user.email, ...mail });
    log.info(
      { jobId: job.id, userId, email: user.email },
      "Registration code sent",
    );
  },

  async "send-login-code"({ userId, code }, job) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      log.warn(
        { userId, jobId: job.id },
        "User no longer exists, skipping login code",
      );
      return;
    }

    const mail = loginCodeEmail({
      code,
      expiresInMinutes: config.auth.loginCodeTtlMinutes,
    });

    // Recipient only. The code is the credential — the root logger redacts a
    // field named `token`, and that is a safety net, not permission to hand it
    // one.
    await sendMail({ to: user.email, ...mail });
    log.info({ jobId: job.id, userId, email: user.email }, "Login code sent");
  },

  async "send-reset"({ userId, token }, job) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      log.warn(
        { userId, jobId: job.id },
        "User no longer exists, skipping reset email",
      );
      return;
    }

    const mail = passwordResetEmail({
      name: user.name,
      resetUrl: `${config.clientOrigin}/reset-password?token=${encodeURIComponent(token)}`,
      expiresInHours: config.auth.passwordResetTtlHours,
    });

    await sendMail({ to: user.email, ...mail });
    log.info(
      { jobId: job.id, userId, email: user.email },
      "Password reset email sent",
    );
  },

  /**
   * "You were assigned a task."
   *
   * The task is read back here rather than carried in the payload, for the
   * reason the header gives: its title may have changed between the assignment
   * and this run, and the email should say what the task is called when it
   * lands. The in-app notification deliberately does the opposite — see
   * `notification.dto.js`.
   *
   * A missing user or task RETURNS rather than throws. Both mean the job can
   * never succeed (the account was deleted, the task was purged), and throwing
   * would burn every attempt on something unsendable.
   */
  async "send-assignment"(
    { userId, taskId, actorName, sprintName, projectName },
    job,
  ) {
    const [user, task] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      /* `key` is not a column — it is `${project.key}-${number}`, composed
         wherever a task is rendered (`task.dto.js`). The project key is
         immutable and the number never changes, so there is nothing to store. */
      prisma.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          number: true,
          title: true,
          deletedAt: true,
          projectId: true,
          project: { select: { key: true } },
        },
      }),
    ]);

    if (!user || !task || task.deletedAt) {
      log.warn(
        { userId, taskId, jobId: job.id },
        "User or task no longer available, skipping assignment email",
      );
      return;
    }

    const mail = taskAssignedEmail({
      name: user.name,
      actorName,
      taskKey: `${task.project?.key ?? ''}-${task.number}`,
      taskTitle: task.title,
      projectName,
      sprintName,
      taskUrl: `${config.clientOrigin}/board/backlog?project=${encodeURIComponent(task.projectId)}&task=${encodeURIComponent(task.id)}`,
    });

    await sendMail({ to: user.email, ...mail });
    log.info(
      { jobId: job.id, userId, taskId },
      "Assignment email sent",
    );
  },
};

const processEmailJob = async (job) => {
  const handler = handlers[job.name];
  if (handler) return handler(job.data, job);

  if (job.name === "send-invitation") {
    const { invitationId, token } = job.data;

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { workspace: true, invitedBy: true },
    });

    // The invitation was revoked (or the workspace deleted) between the
    // enqueue and this run. Return rather than throw: there is nothing to
    // retry, and a thrown error would burn all five attempts on a job that
    // can never succeed.
    if (!invitation) {
      log.warn(
        { invitationId, jobId: job.id },
        "Invitation no longer exists, skipping",
      );
      return;
    }

    if (invitation.acceptedAt) {
      log.warn(
        { invitationId, jobId: job.id },
        "Invitation already accepted, skipping",
      );
      return;
    }

    // Expired between enqueue and delivery — sending a link that 410s on the
    // first click is worse than sending nothing. Same reasoning as above:
    // return, do not retry.
    if (invitation.expiresAt <= new Date()) {
      log.warn(
        { invitationId, jobId: job.id },
        "Invitation expired before send, skipping",
      );
      return;
    }

    // The raw token comes from the job payload, NOT from the row: only its
    // SHA-256 is stored, so `invitation.tokenHash` cannot rebuild the link.
    // A job enqueued before this change (or by a producer that forgot) has no
    // token, and there is nothing to retry — the link is unrecoverable.
    if (!token) {
      log.error(
        { invitationId, jobId: job.id },
        "Invitation job carries no raw token, skipping",
      );
      return;
    }

    // The token is the credential. It is interpolated into the mail and never
    // into a log line — the logger redacts a field named `token`, but it
    // cannot see one spliced into a URL string.
    const inviteUrl = `${config.clientOrigin}/invite/${encodeURIComponent(token)}`;

    const { subject, html, text } = invitationEmail({
      workspaceName: invitation.workspace.name,
      inviterName: invitation.invitedBy.name,
      inviteUrl,
      expiresAt: invitation.expiresAt,
    });

    await sendMail({ to: invitation.email, subject, html, text });

    log.info(
      {
        jobId: job.id,
        invitationId,
        email: invitation.email,
        workspace: invitation.workspace.name,
      },
      "Invitation email sent",
    );

    return;
  }

  // An unknown job name means a producer and this worker have drifted apart.
  // Fail loudly rather than silently dropping the job.
  throw new Error(`Unsupported email job: ${job.name}`);
};

// `autorun: false` is load-bearing. A Worker constructed with the default
// starts pulling jobs the moment this module is imported — which is before
// the entrypoint's `await`s have run, so the startup checks would race the
// first job instead of gating it, and a worker with unusable SMTP credentials
// would drain the queue into failed jobs while still "starting up".
// src/workers/index.js calls `emailWorker.run()` once the checks in
// registry.js pass.
const emailWorker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
  connection,
  // Must match the producer's prefix — see email.queue.js.
  prefix: EMAIL_QUEUE_PREFIX,
  // How many jobs this worker holds at once. A job is mostly waiting — a
  // Postgres read of the row, then an SMTP round-trip — so at concurrency 1 the
  // worker idles through both while the queue grows.
  //
  // The useful ceiling here is `config.mail.maxConnections`, NOT this number:
  // Nodemailer serialises sends through its pool, so past that the extra jobs
  // wait inside the pool instead of inside BullMQ. Raising this alone makes the
  // database half of each job parallel and the send half no faster.
  concurrency: config.worker.concurrency,
  autorun: false,
});

emailWorker.on("completed", (job) => {
  log.info({ jobId: job.id, jobName: job.name }, "Job completed");
});

emailWorker.on("failed", (job, error) => {
  // `attemptsMade` vs `attempts` is what separates "will be retried shortly"
  // from "this mail is now permanently undelivered", and only the second one
  // is worth waking someone for.
  log.error(
    {
      err: error,
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade: job?.attemptsMade,
      attemptsAllowed: job?.opts?.attempts,
    },
    "Job failed",
  );
});

export default emailWorker;
