/**
 * HTML + plaintext bodies for every message the email worker sends.
 *
 * Templates live here rather than in the worker so the worker stays a job
 * router — read the row, guard, send — and so copy can change without
 * touching queue semantics. Each builder returns `{ subject, html, text }`,
 * exactly the shape `sendMail` takes.
 *
 * Two constraints drive how these are written:
 *
 * 1. **Inline styles only, tables for layout.** Gmail strips `<style>` blocks
 *    and Outlook renders with Word's engine — flexbox, grid and external CSS
 *    are all unreliable. What looks like needless repetition below is the
 *    only thing that renders the same in both.
 * 2. **Every interpolated value is escaped.** Workspace and user names are
 *    user-controlled; an unescaped apostrophe or `<` breaks the markup and an
 *    unescaped tag is an injection into whatever the recipient's client
 *    renders.
 *
 * Every message ships a plaintext alternative. Mail with an HTML part and no
 * text part is a spam-filter signal, and some clients show the raw markup.
 *
 * See src/shared/utils/mailer.js and src/workers/email.worker.js
 */

const BRAND = 'Tizello';

/**
 * Escapes the five characters that are unsafe in HTML text and attribute
 * positions. Applied to every interpolated value without exception — deciding
 * per value which ones are "safe" is how the one that was not gets missed.
 */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Wraps body markup in the shared shell: centered card, heading, footer.
 *
 * `bodyHtml` is the one argument passed through unescaped — callers assemble
 * it from already-escaped values. `preheader` is the grey line clients show
 * next to the subject in the inbox list; left out, they pull the first words
 * of the body instead, which is usually a greeting and tells the reader
 * nothing.
 */
const layout = ({ title, preheader, bodyHtml }) => `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e6ea;">
            <tr>
              <td style="padding:32px 40px 8px 40px;">
                <p style="margin:0 0 24px 0;font-size:18px;font-weight:700;color:#172b4d;letter-spacing:-0.2px;">${BRAND}</p>
                <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#172b4d;line-height:1.35;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px 40px;font-size:15px;line-height:1.6;color:#42526e;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
          <p style="max-width:560px;margin:20px auto 0 auto;font-size:12px;line-height:1.5;color:#8993a4;text-align:center;">
            You received this email because someone used this address on ${BRAND}.<br />
            If it was not you, no action is needed.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

/**
 * A primary call-to-action button.
 *
 * Rendered as a padded anchor rather than a `<button>`: buttons do not
 * survive most mail clients, and every template pairs this with the raw URL
 * in text underneath, because clients that block link styling still show it.
 */
const button = ({ href, label }) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr>
      <td style="background-color:#0052cc;border-radius:6px;">
        <a href="${escapeHtml(href)}"
           style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;

/**
 * Renders an expiry as a whole number of days for the copy.
 *
 * Rounded up: an invitation with 6.2 days left reads as "7 days", which is
 * the promise the product makes (INVITE_TTL_DAYS, and the frontend's
 * "Invitation links last seven days"). Rounding down would understate it.
 */
const daysUntil = (expiresAt) => {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
};

/**
 * Workspace invitation — the mail behind the `send-invitation` job.
 *
 * `inviteUrl` already contains the raw token; it is the credential, so it
 * must never be logged, only rendered here.
 */
const invitationEmail = ({ workspaceName, inviterName, inviteUrl, expiresAt }) => {
  const workspace = escapeHtml(workspaceName);
  const inviter = escapeHtml(inviterName);
  const days = daysUntil(expiresAt);

  const subject = `${inviterName} invited you to ${workspaceName} on ${BRAND}`;

  const html = layout({
    title: `You have been invited to ${workspaceName}`,
    preheader: `${inviterName} invited you to join ${workspaceName}.`,
    bodyHtml: `
      <p style="margin:0;">
        <strong style="color:#172b4d;">${inviter}</strong> invited you to join the
        <strong style="color:#172b4d;">${workspace}</strong> workspace on ${BRAND}.
      </p>
      ${button({ href: inviteUrl, label: 'Accept invitation' })}
      <p style="margin:0 0 8px 0;font-size:13px;color:#6b778c;">
        Or paste this link into your browser:
      </p>
      <p style="margin:0 0 24px 0;font-size:13px;word-break:break-all;">
        <a href="${escapeHtml(inviteUrl)}" style="color:#0052cc;">${escapeHtml(inviteUrl)}</a>
      </p>
      <p style="margin:0;font-size:13px;color:#6b778c;">
        This invitation expires in ${days} day${days === 1 ? '' : 's'}. If you were not
        expecting it, you can ignore this email.
      </p>`,
  });

  const text = [
    `${inviterName} invited you to join the ${workspaceName} workspace on ${BRAND}.`,
    '',
    'Accept the invitation:',
    inviteUrl,
    '',
    `This invitation expires in ${days} day${days === 1 ? '' : 's'}.`,
    'If you were not expecting it, you can ignore this email.',
  ].join('\n');

  return { subject, html, text };
};

/**
 * Six-digit registration code — the mail behind `send-registration-code`.
 *
 * Same visual treatment as `loginCodeEmail` below (large monospace code,
 * subject carries it too) since it is the same shape of secret; the copy is
 * "confirm your account" rather than "sign in."
 */
const registrationCodeEmail = ({ code, expiresInMinutes }) => {
  const safeCode = escapeHtml(code);

  const subject = `${code} is your ${BRAND} confirmation code`;

  const html = layout({
    title: 'Confirm your account',
    preheader: `${code} — expires in ${expiresInMinutes} minutes.`,
    bodyHtml: `
      <p style="margin:0;">Enter this code to finish creating your account.</p>
      <p style="margin:28px 0;font-size:34px;font-weight:700;letter-spacing:10px;color:#172b4d;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">
        ${safeCode}
      </p>
      <p style="margin:0;font-size:13px;color:#6b778c;">
        The code expires in ${expiresInMinutes} minutes and can be used once. If
        you did not create an account, you can ignore this email.
      </p>`,
  });

  const text = [
    `Your ${BRAND} confirmation code is ${code}`,
    '',
    `It expires in ${expiresInMinutes} minutes and can be used once.`,
    'If you did not create an account, you can ignore this email.',
  ].join('\n');

  return { subject, html, text };
};

/**
 * Six-digit sign-in code — the mail behind `send-login-code`.
 *
 * The code is rendered large and spaced because it is transcribed by hand, and
 * it appears in the subject line too: on a phone the notification alone is
 * often enough, which is the whole ergonomic argument for codes over passwords.
 */
const loginCodeEmail = ({ code, expiresInMinutes }) => {
  const safeCode = escapeHtml(code);

  const subject = `${code} is your ${BRAND} sign-in code`;

  const html = layout({
    title: 'Your sign-in code',
    preheader: `${code} — expires in ${expiresInMinutes} minutes.`,
    bodyHtml: `
      <p style="margin:0;">Enter this code to finish signing in.</p>
      <p style="margin:28px 0;font-size:34px;font-weight:700;letter-spacing:10px;color:#172b4d;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">
        ${safeCode}
      </p>
      <p style="margin:0;font-size:13px;color:#6b778c;">
        The code expires in ${expiresInMinutes} minutes and can be used once. If
        you did not try to sign in, someone else has your address — you can
        ignore this email, and no one can sign in without the code.
      </p>`,
  });

  const text = [
    `Your ${BRAND} sign-in code is ${code}`,
    '',
    `It expires in ${expiresInMinutes} minutes and can be used once.`,
    'If you did not try to sign in, you can ignore this email.',
  ].join('\n');

  return { subject, html, text };
};

/**
 * Password reset — the mail behind `send-reset`.
 *
 * The copy says the password has not changed yet, because the most common
 * reader of this email is someone who did not ask for it and needs to know
 * whether they have to act.
 */
const passwordResetEmail = ({ name, resetUrl, expiresInHours }) => {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
  const window = expiresInHours === 1 ? '1 hour' : `${expiresInHours} hours`;

  const subject = `Reset your ${BRAND} password`;

  const html = layout({
    title: 'Reset your password',
    preheader: `Choose a new ${BRAND} password. Link valid for ${window}.`,
    bodyHtml: `
      <p style="margin:0;">${greeting}</p>
      <p style="margin:12px 0 0 0;">
        Use the link below to choose a new password.
      </p>
      ${button({ href: resetUrl, label: 'Choose a new password' })}
      <p style="margin:0 0 8px 0;font-size:13px;color:#6b778c;">
        Or paste this link into your browser:
      </p>
      <p style="margin:0 0 24px 0;font-size:13px;word-break:break-all;">
        <a href="${escapeHtml(resetUrl)}" style="color:#0052cc;">${escapeHtml(resetUrl)}</a>
      </p>
      <p style="margin:0;font-size:13px;color:#6b778c;">
        This link expires in ${window}. If you did not request a reset, you can
        ignore this email — <strong>your password has not changed</strong>.
      </p>`,
  });

  const text = [
    `${name ? `Hi ${name},` : 'Hi,'}`,
    '',
    'Use this link to choose a new password:',
    resetUrl,
    '',
    `This link expires in ${window}.`,
    'If you did not request a reset, ignore this email — your password has not changed.',
  ].join('\n');

  return { subject, html, text };
};

/**
 * "You were assigned a task." The one notification email the app sends about
 * work rather than about an account.
 *
 * The SPRINT is in the subject when there is one, and that is the whole reason
 * this template exists separately from a generic "something changed" digest:
 * "in Sprint 3" is what tells somebody whether this is for this week or for
 * later, and it is the first thing they want from the line in their inbox.
 *
 * `taskKey` is shown rather than the id — `TIZ-42` is what the board, the card
 * and the URL all call it, and a cuid in an email is a string nobody can act
 * on.
 */
const taskAssignedEmail = ({ name, actorName, taskKey, taskTitle, projectName, sprintName, taskUrl }) => {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
  const actor = escapeHtml(actorName);
  const key = escapeHtml(taskKey);
  const title = escapeHtml(taskTitle);
  const where = sprintName
    ? `${escapeHtml(sprintName)}`
    : projectName
      ? `${escapeHtml(projectName)}`
      : null;

  const subject = sprintName
    ? `${actorName} assigned you ${taskKey} in ${sprintName}`
    : `${actorName} assigned you ${taskKey}`;

  const html = layout({
    title: 'You have a new task',
    preheader: `${actorName} assigned you ${taskKey}: ${taskTitle}`,
    bodyHtml: `
      <p style="margin:0;">${greeting}</p>
      <p style="margin:12px 0 0 0;">
        <strong style="color:#172b4d;">${actor}</strong> assigned you
        <strong style="color:#172b4d;">${key}</strong>.
      </p>
      <p style="margin:16px 0 0 0;font-size:16px;color:#172b4d;">${title}</p>
      ${where ? `<p style="margin:6px 0 0 0;font-size:13px;color:#6b778c;">In ${where}</p>` : ''}
      ${button({ href: taskUrl, label: 'Open the task' })}
      <p style="margin:0;font-size:13px;color:#6b778c;">
        You are getting this because someone put you on this task in ${BRAND}.
      </p>`,
  });

  const text = [
    greeting,
    '',
    `${actorName} assigned you ${taskKey}.`,
    taskTitle,
    where ? `In ${sprintName ?? projectName}` : null,
    '',
    taskUrl,
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { subject, html, text };
};

export {
  taskAssignedEmail,
  invitationEmail,
  registrationCodeEmail,
  loginCodeEmail,
  passwordResetEmail,
  layout,
  button,
  escapeHtml,
};
