import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { TaskStatusChip } from "@/components/tasks/task-status-chip";
import { TaskTypeIcon } from "@/components/tasks/task-type-icon";
import type { SearchResults, TaskHit } from "@/types/search";

/*
 * One flat, ordered list of everything the palette can jump to.
 *
 * THE KEYBOARD AND THE MARKUP READ THE SAME ARRAY, which is the whole point of
 * flattening three typed lists into one: the arrow keys walk indices into this
 * array and the rows are rendered from it, so "the third row" means one thing.
 * Two parallel structures — groups for display, a derived list for navigation —
 * is how a palette ends up highlighting one row and opening another.
 *
 * TASKS FIRST, THEN PROJECTS, THEN SPRINTS. Not by relevance: there is no
 * ranking (`backend/docs/api/search.md` §Matching), and ordering by a score
 * that does not exist would be a lie the reader can catch by typing a word
 * that appears in a project name. This order is by what people look for.
 *
 * WHERE A TASK LINKS. To the board that actually shows it — the sprint board
 * if it is in a sprint, the backlog if it is not. The two screens hold
 * different work (`.claude/rules/workflow.md`), so a single destination for
 * both would land half the results on a screen their task is missing from.
 */

export type Hit = {
  id: string;
  href: string;
  group: string;
  label: string;
  /** The second line: key, project, workspace — whatever locates it. */
  meta: string;
  icon: React.ReactNode;
  badge: React.ReactNode;
};

const taskHref = (hit: TaskHit) =>
  hit.sprintId ? `/board/sprint?project=${hit.projectId}` : `/board/backlog?project=${hit.projectId}`;

const Dot = ({ className }: { className: string }) => <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${className}`} />;

export function flattenHits(results: SearchResults): Hit[] {
  return [
    ...results.tasks.map((hit) => ({
      id: `task:${hit.id}`,
      href: taskHref(hit),
      group: "Tasks",
      label: hit.title,
      meta: `${hit.key} · ${hit.projectName}`,
      icon: <TaskTypeIcon type={hit.type} />,
      badge: hit.status ? <TaskStatusChip status={hit.status} /> : null,
    })),
    ...results.projects.map((hit) => ({
      id: `project:${hit.id}`,
      href: `/workspaces/${hit.workspaceId}/projects/${hit.id}`,
      group: "Projects",
      label: hit.name,
      meta: [hit.key, hit.workspaceName].filter(Boolean).join(" · "),
      icon: <Dot className="bg-label-blue" />,
      badge: <ProjectStatusBadge status={hit.status} />,
    })),
    ...results.sprints.map((hit) => ({
      id: `sprint:${hit.id}`,
      href: `/board/sprint-planning?project=${hit.projectId}`,
      group: "Sprints",
      label: hit.name,
      meta: `${hit.key} · ${hit.projectName}`,
      icon: <Dot className="bg-label-purple" />,
      badge: null,
    })),
  ];
}
