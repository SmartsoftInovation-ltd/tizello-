import { Icon, type IconProps } from "@/components/ui/icons";
import { MembersIcon, PersonIcon } from "@/components/ui/nav-icons";
import { cn } from "@/lib/cn";

/*
 * Sign-up's panel content: the four steps of joining as a vertical timeline —
 * an icon tile, a title and one line each, joined by a rail — with the first
 * step current. It replaces the features diagram on this one route, so
 * sign-up and sign-in read as different screens at a glance.
 *
 * Drawn in `text-on-board` over the green field, like the rest of the panel.
 * Static: the later steps live on their own pages.
 */
function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2.5 4.5 8 8.5l5.5-4" />
    </Icon>
  );
}

function RocketIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 2.5c2.5 0 4 1.5 4 4-1.5 2.5-4 4.5-6 5.5L4 8.5c1-2 3-4.5 5.5-6z" />
      <path d="M4 8.5 2.5 9l1 3.5L7 13.5l.5-1.5M10 6h.01" />
    </Icon>
  );
}

const STEPS = [
  { Glyph: PersonIcon, title: "Your details", text: "Provide an email and password" },
  { Glyph: MailIcon, title: "Verify your email", text: "Enter your verification code" },
  { Glyph: MembersIcon, title: "Invite your team", text: "Start collaborating with your team" },
  { Glyph: RocketIcon, title: "Welcome to Tizello!", text: "Get up and running in 3 minutes" },
] as const;

const CURRENT = 0;

export function SignUpJourney() {
  return (
    <div className="relative w-full max-w-sm text-on-board">
      <p className="text-2xs font-semibold tracking-widest uppercase opacity-80">Get started</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">Four steps to your first board</h2>

      <ol aria-label="Sign-up steps" className="mt-8">
        {STEPS.map(({ Glyph, title, text }, index) => {
          const current = index === CURRENT;
          return (
            <li key={title} aria-current={current ? "step" : undefined} className="relative flex gap-4 pb-8 last:pb-0">
              {index < STEPS.length - 1 && (
                <span aria-hidden="true" className="absolute top-11 bottom-1 left-5 w-px bg-on-board/30" />
              )}
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-lg border",
                  current ? "border-on-board bg-on-board/20 ring-4 ring-on-board/10" : "border-on-board/30 bg-on-board/5",
                )}
              >
                <Glyph className="size-5" />
              </span>
              <span className={cn("min-w-0 pt-0.5", !current && "opacity-70")}>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm opacity-85">{text}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
