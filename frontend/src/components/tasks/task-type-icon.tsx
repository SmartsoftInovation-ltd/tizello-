import { cn } from "@/lib/cn";
import { TASK_TYPE_LABEL, type TaskType } from "@/types/task";

/*
 * The small square that says what kind of work a task is — the mark Jira and
 * Linear put before a key.
 *
 * A tint of a `label-*` hue with the hue as ink: those primitives are the
 * app's decorative palette and identical in both themes, so the square reads
 * the same in light and dark without a token of its own. The SHAPE inside
 * differs per type as well as the colour, so the mark is not colour-only.
 *
 * Complete class strings per type, never interpolated (DESIGN-SYSTEM.md).
 */
const TONE: Record<TaskType, string> = {
  TASK: "bg-label-blue/20 text-label-blue",
  STORY: "bg-label-green/20 text-label-green",
  BUG: "bg-label-red/20 text-label-red",
  EPIC: "bg-label-purple/20 text-label-purple",
};

const GLYPH: Record<TaskType, React.ReactNode> = {
  TASK: <path d="M4.5 8.25l2.25 2.25 4.75-5" />,
  STORY: <path d="M5 3.5h6v9L8 10.5 5 12.5z" />,
  BUG: <circle cx="8" cy="8" r="3.25" fill="currentColor" stroke="none" />,
  EPIC: <path d="M9 2.5L4.5 9H8l-1 4.5L11.5 7H8z" />,
};

export function TaskTypeIcon({
  type,
  size = "sm",
  className,
}: {
  type: TaskType;
  /** `sm` for rows, `lg` beside the drawer's title. */
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <span
      title={TASK_TYPE_LABEL[type]}
      className={cn(
        "grid shrink-0 place-items-center rounded-xs",
        size === "lg" ? "size-9 rounded-md" : "size-4",
        TONE[type],
        className,
      )}
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={size === "lg" ? "size-5" : "size-3"}
      >
        {GLYPH[type]}
      </svg>
      <span className="sr-only">{TASK_TYPE_LABEL[type]}</span>
    </span>
  );
}
