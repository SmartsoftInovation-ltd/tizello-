import { redirect } from "next/navigation";
import { AuthAside } from "@/components/auth/auth-aside";
import { AuthColumn } from "@/components/auth/auth-column";
import { SignUpSteps } from "@/components/auth/sign-up-steps";
import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthFooter } from "@/components/auth/auth-footer";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { getSession } from "@/lib/auth";
import { inviteTokenFromNext } from "@/lib/invites";
import { HOME } from "@/lib/session-cookie";
import { safeNextPath } from "@/lib/validation/auth";

export const metadata = {
  title: "Sign up",
  description: "Create a Tizello account — boards, lists and cards for your team.",
};

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { next } = await searchParams;
  const target = safeNextPath(typeof next === "string" ? next : undefined);

  /* Reverse guard: an existing session has no business on this screen. */
  if (await getSession()) redirect(target ?? HOME);

  /* An invited recipient arrives as `?next=/invite/<token>`. Handing the token
     to the form is what lets registration double as accepting: the API applies
     it, verifies the address and returns a session in one call. */
  const inviteToken = inviteTokenFromNext(target);

  return (
    <>
      <AuthColumn
        heading="Sign up for Tizello"
        sub="Free forever for your first 10 boards."
        top={<SignUpSteps />}
        mirrored
      >
        <SignUpForm inviteToken={inviteToken} />
        <AuthDivider label="or continue with" />
        <SocialButtons next={target ?? undefined} />

        {/* Symmetric with sign-in's link back here: whichever screen someone
            bounces between, the destination they were headed for survives. */}
        <AuthFooter
          prompt="Already have an account?"
          href={target ? `/sign-in?next=${encodeURIComponent(target)}` : "/sign-in"}
          label="Log in"
        />
      </AuthColumn>

      <AuthAside variant="sign-up" />
    </>
  );
}
