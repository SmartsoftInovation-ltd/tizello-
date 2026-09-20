import { redirect } from "next/navigation";
import { PageTop } from "@/components/layout/page-top";
import { MyTasksPanel } from "@/components/my-tasks/my-tasks-panel";
import { TasksIcon } from "@/components/ui/app-icons";
import { getSession } from "@/lib/auth";
import { getAssignedTasks } from "@/lib/my-tasks";
import { todayIso } from "@/lib/today";
import { ASSIGNED_STATES, type AssignedState } from "@/types/task";

export const metadata = {
  title: "My tasks",
  description: "Everything assigned to you, across every project you can see, ordered by when it is due.",
};

/* Anything unrecognised falls back rather than 404s — a stale link still opens. */
function parseState(value: string | string[] | undefined): AssignedState {
  return ASSIGNED_STATES.find((state) => state === value) ?? "open";
}

/**
 * `/my-tasks` — the sidebar's My tasks row.
 *
 * NO `?project=` PICKER, unlike every other board screen. That is the point of
 * this page: it is the one view that does not belong to a project, and adding
 * a project filter would turn it back into the backlog.
 *
 * `today` is resolved on the server and passed down, never read from a clock
 * in a component — `lib/today.ts` records why that distinction is load-bearing
 * rather than stylistic.
 */
export default async function MyTasksPage({ searchParams }: PageProps<"/my-tasks">) {
  const { state: requested } = await searchParams;

  const user = await getSession();
  if (!user) redirect("/sign-in?next=/my-tasks");

  const state = parseState(requested);
  /* The WHOLE list, every state: the progress bar needs the denominator,
     and the panel does the tab's filtering itself. See `lib/my-tasks.ts`. */
  const tasks = await getAssignedTasks();

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <PageTop>
        <header>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-text">
            <TasksIcon className="size-5 shrink-0 text-text-muted" />
            My tasks
          </h1>
          <p className="mt-1 max-w-prose text-sm text-text-muted">
            Everything assigned to you, from every project you can see — soonest first.
          </p>
        </header>
      </PageTop>

      <MyTasksPanel tasks={tasks} state={state} today={todayIso()} />
    </main>
  );
}
