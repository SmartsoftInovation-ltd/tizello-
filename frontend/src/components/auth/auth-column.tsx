import { AuthLogo } from "@/components/auth/auth-logo";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthLegalFooter } from "@/components/auth/auth-legal-footer";

/**
 * The left half of the split shell: logo pinned top-left, form column centred
 * at 352px, legal footer at the bottom. Full width below `lg`, where the aside
 * is removed.
 *
 * It sits in the page rather than the layout because the layout provides only
 * the grid — the page has to render its own `<AuthAside variant>` as the second
 * grid child, and children cannot be nested inside this column for that.
 *
 * Its background is a green wash (`auth-column` in globals.css) rather than
 * plain surface, so the form half and the green panel read as one screen in
 * both themes; the glow leans toward whichever side the panel is on.
 */
export function AuthColumn({
  heading,
  sub,
  top,
  mirrored = false,
  children,
}: {
  heading: string;
  sub?: string;
  /** Drawn above the heading — sign-up's steps. */
  top?: React.ReactNode;
  /** The panel sits on the LEFT (sign-up), so the green glow leans that way. */
  mirrored?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`auth-fields flex min-h-dvh flex-col px-6 py-8 sm:px-10 ${mirrored ? "auth-column-mirrored" : "auth-column"}`}>
      <AuthLogo />

      <main className="flex flex-1 items-center py-10">
        <div className="auth-enter mx-auto w-full max-w-[22rem]">
          {top}
          <AuthHeader heading={heading} sub={sub} />
          {children}
        </div>
      </main>

      <AuthLegalFooter />
    </div>
  );
}
