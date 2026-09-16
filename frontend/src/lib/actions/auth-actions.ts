"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  endSession,
  login,
  register,
  requestLoginCode,
  verifyLoginCode,
} from "@/lib/auth";
import { inviteTokenFromNext } from "@/lib/invites";
import { HOME, homeWithWelcome } from "@/lib/session-cookie";
import {
  normaliseEmail,
  safeNextPath,
  validateCode,
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/validation/auth";
import { AUTH_ERROR_COPY, type AuthFormState, type User } from "@/types/auth";

/*
 * Every field is re-validated here. The client-side rules in
 * `lib/validation/auth.ts` are a convenience; this is the control (spec §7).
 * `redirect()` throws, so it is always the last statement on a success path.
 */

const field = (name: string, message: string): AuthFormState => ({
  fieldErrors: { [name]: message },
});

/** Either a credential that checked out, or the state to render instead. */
type StepResult = { user: User } | { state: AuthFormState };

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "");
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  /* Filled in by the hidden field the invite path adds — the raw token the
     sign-up page pulled out of `?next=/invite/<token>`. Absent on an ordinary
     sign-up, and the API treats a bad one as "not applied" rather than as a
     failed registration. */
  const inviteToken = String(formData.get("inviteToken") ?? "") || undefined;

  const errors: Record<string, string> = {};
  const nameError = validateName(name);
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  if (nameError) errors.name = nameError;
  if (emailError) errors.email = emailError;
  if (passwordError) errors.password = passwordError;
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  const result = await register({ name, email, password, inviteToken });
  if (!result.ok) {
    if (result.code === "EMAIL_TAKEN") {
      return field("email", AUTH_ERROR_COPY.EMAIL_TAKEN);
    }
    if (result.code === "WEAK_PASSWORD") {
      return field("password", AUTH_ERROR_COPY.WEAK_PASSWORD);
    }
    return { code: result.code };
  }

  /* An applied invitation is proof of the address — the token was delivered to
     it and came back — so the API returns a verified account *and* a session.
     Sending someone to `/verify-email` here is the deadlock the API's §6.4 note
     describes: no verification email is ever sent on this path, so they would
     wait on one that never arrives and `/login` would answer
     EMAIL_NOT_VERIFIED. They are already signed in.

     The destination is HOME, not `next`: `next` is the invitation page, and
     the invitation has just been accepted, so sending them back there shows
     the "you are already a member" state for something they never chose on
     that screen. `homeWithWelcome()` is the same celebration every other
     proven credential gets. */
  if (result.inviteApplied) redirect(homeWithWelcome());

  /* Unverified accounts do not get a session — verification is a wall. The
     registration code was already sent as part of `register()`; this page
     just collects it.

     `next` is deliberately dropped here. Carrying it would mean threading it
     through the verify page, its code form and `verifyRegistrationCodeAction`,
     and the only destination that currently sets one is `/invite/<token>` —
     which is reachable again from the invite page once the address is
     confirmed. Add it when a second caller needs it.

     Reaching here *with* an `inviteToken` means the API declined to apply it,
     and the ordinary reason is the address: an invitation is bound to the one
     it was sent to, and the public lookup deliberately does not disclose it, so
     the form cannot pre-fill or check it. The account is real and the
     invitation is untouched — say so on the next screen rather than letting
     someone verify their email and then wonder where the workspace went. */
  const declined = inviteToken && !result.inviteApplied ? "&invite=unapplied" : "";
  redirect(`/verify-email?email=${encodeURIComponent(email)}${declined}`);
}

/**
 * Step 2 of sign-in, both modes. Step 1 never reaches here: it validates the
 * email's shape in the browser and advances, so there is no unauthenticated
 * endpoint that reveals whether an address is registered (spec §6.2).
 */
export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  const mode = formData.get("mode") === "password" ? "password" : "code";
  /* "Remember me" is read by the form but no longer acted on here. Session
     lifetime is REFRESH_TOKEN_TTL_DAYS on the API, which is the only side that
     can enforce it rather than merely suggest it — a client-set maxAge is a
     hint the server never sees. Wiring the checkbox through is a backend
     change (a per-session TTL on /login), not a frontend one. */
  const next = safeNextPath(String(formData.get("next") ?? "")) ?? HOME;

  const emailError = validateEmail(email);
  if (emailError) return field("email", emailError);

  /* Only the password path needs it. The code path already verifies the address
     on its own — redeeming a code mailed there proves it — so a token would be
     redundant there. */
  const inviteToken = inviteTokenFromNext(next);

  const result = await (mode === "password"
    ? passwordSignIn(email, String(formData.get("password") ?? ""), inviteToken)
    : codeSignIn(email, String(formData.get("code") ?? "")));

  if ("state" in result) return result.state;

  /* No startSession call: the API set tizello_access and tizello_refresh on the
     sign-in response and lib/api-client.ts forwarded them onto this one. There
     is no second session for this app to mint, and minting one would mean two
     notions of "signed in" with only one of them revocable. */
/*
 * Signing in or out changes what every page renders, and Next's client-side
 * Router Cache does not know that: it keeps the RSC payload it already has, so
 * the redirect lands, the URL changes, and the browser re-shows the *cached*
 * pre-session render — a signed-in user staring at the sign-in form under a
 * /workspaces URL. `revalidatePath("/", "layout")` drops every cached segment
 * from the root down, which is the only granularity that covers a change this
 * global.
 */
  revalidatePath("/", "layout");
  redirect(next === HOME ? homeWithWelcome() : next);
}

async function passwordSignIn(
  email: string,
  password: string,
  inviteToken?: string,
): Promise<StepResult> {
  if (password.length === 0) {
    return { state: field("password", "Enter your password.") };
  }
  const result = await login({ email, password, inviteToken });
  return result.ok ? { user: result.user } : { state: { code: result.code } };
}

async function codeSignIn(email: string, code: string): Promise<StepResult> {
  const codeError = validateCode(code);
  if (codeError) return { state: field("code", codeError) };
  const result = await verifyLoginCode({ email, code });
  return result.ok ? { user: result.user } : { state: { code: result.code } };
}

/**
 * Fires when step 2 opens in code mode, and again on Resend. Returns nothing:
 * a 202 for every address, known or not, is the whole point.
 */
export async function requestSignInCodeAction(email: string): Promise<void> {
  if (validateEmail(email)) return;
  await requestLoginCode(email);
}

/**
 * A POST, never a link — a GET that mutates is CSRF-able and gets prefetched.
 * Waits for the API to confirm the logout; on a failure it returns the error
 * for the menu to show, and the session is left exactly as it was.
 */
export async function signOutAction(): Promise<{ error: string }> {
  const result = await endSession();
  if (!result.ok) {
    return {
      error: result.code === "RATE_LIMITED" ? AUTH_ERROR_COPY.RATE_LIMITED : "Couldn't sign you out. Try again.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/sign-in");
}
