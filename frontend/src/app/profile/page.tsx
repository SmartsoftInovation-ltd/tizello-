import { PageTop } from "@/components/layout/page-top";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ProfileCard } from "@/components/profile/profile-card";
import { ProfileFacts } from "@/components/profile/profile-facts";
import { ProfileForm } from "@/components/profile/profile-form";
import { ProfileIdentityCard } from "@/components/profile/profile-identity-card";
import { avatarSrc, displayName, getProfile } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your name, nickname, photo and phone number.",
};

/**
 * A Server Component. The shell comes from `profile/layout.tsx`; this renders
 * page content only.
 *
 * **Three columns, and the order is the reading order.** Who you are, what you
 * can change about it, what the account is on record as. The middle column is
 * the only one with controls in it, which is what makes the split worth having
 * — identity on one side of the edit, the record on the other.
 *
 * **No `max-w` on the main**, like `/workspaces` and the workspace detail page:
 * the app shell already sets the reading width by taking the sidebar out of the
 * viewport, and a clamp on top of that leaves a band of empty canvas down the
 * right on a wide screen. The columns absorb the width instead.
 *
 * The identity column is fixed at `18rem` and the other two share what is left.
 * It holds an 80px disc, a name and two buttons — content with a natural width
 * that does not improve with more room — while the form's fields and the
 * record's email address both read better wider. `1fr 1fr` for those two rather
 * than sizing them to their content, so the two card edges line up down the
 * page instead of landing wherever the longest value happens to fall.
 *
 * **They share a height, and that is a grid property, not a card one.** Grid
 * items stretch to their row by default, so what makes this work is the absence
 * of `items-start` plus `h-full` inside `ProfileCard` — the item fills the row,
 * and the card fills the item. Each card then pins its own last element with
 * `mt-auto`, so the slack lands between the content and the footer rather than
 * under it.
 *
 * `lg:` is where it splits. Below that they stack in the same order, which is
 * the right one on a phone: see who you are, edit, then read the record.
 *
 * `proxy.ts` does not match `/profile` — its matcher covers `/board` and
 * `/workspaces` — so this redirect is the only guard, not a second one. It is
 * the real check either way: `getProfile()` returning null covers both "no
 * session" and "the token is valid but the row is gone".
 */
export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect("/sign-in?next=/profile");

  const name = displayName(profile);

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <PageTop>
        <Breadcrumb />

        <header className="mt-4">
          <h1 className="text-xl font-semibold tracking-tight text-text">
            Your profile
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            How you appear to everyone in your workspaces.
          </p>
        </header>
      </PageTop>

      {/* Deliberately no `items-start`: stretch is the default, and it is what
          gives every card the row's height. */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[18rem_1fr_1fr]">
        <ProfileIdentityCard
          profile={profile}
          name={name}
          avatarSrc={avatarSrc(profile.avatarUrl)}
        />

        <ProfileCard title="Details" hint="Leave a field empty to clear it.">
          <ProfileForm profile={profile} />
        </ProfileCard>

        <ProfileFacts profile={profile} />
      </div>
    </main>
  );
}
