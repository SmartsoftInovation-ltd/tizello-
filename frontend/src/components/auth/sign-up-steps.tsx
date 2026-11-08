import { cn } from "@/lib/cn";

/*
 * The three steps of joining, with the first one current — sign-up's own
 * marker, so it never reads as the log-in screen, and a promise that this is
 * short. Static: the later steps live on their own pages (verify-email, the
 * workspace screen), which is where they are reached.
 */
const STEPS = ["Create account", "Verify email", "Your workspace"] as const;

export function SignUpSteps() {
  return (
    <ol aria-label="Sign-up steps" className="mb-6 grid grid-cols-3 gap-2">
      {STEPS.map((step, index) => {
        const current = index === 0;
        return (
          <li key={step} aria-current={current ? "step" : undefined} className="min-w-0">
            <span className={cn("block h-1 rounded-full", current ? "bg-brand-500" : "bg-surface-hover")} />
            <span className={cn("mt-1.5 flex items-center gap-1 text-2xs", current ? "font-semibold text-text" : "text-text-subtle")}>
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full text-[0.625rem] font-semibold tabular-nums",
                  current ? "bg-brand-500 text-on-brand" : "bg-surface-hover text-text-subtle",
                )}
              >
                {index + 1}
              </span>
              <span className="truncate">{step}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
