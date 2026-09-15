import { formatDate } from "@/lib/format-date";
import { PROJECT_PRIORITY_LABEL, type ProjectPriority } from "@/types/project";
import { TASK_TYPE_LABEL, type TaskActivity, type TaskActivityField, type TaskType } from "@/types/task";

/*
 * One history entry as a sentence fragment — "changed Status from To do to
 * Review". The actor's name is drawn separately, in bold, by the list.
 *
 * `from` / `to` are display SNAPSHOTS the API took at write time
 * (`backend/docs/api/task.md` §Activity) — `{ id, name }` for a status or a
 * person, `{ id, key, title }` for a parent — so this never looks anything up:
 * a status renamed since, or a person who has left, still reads as it was.
 * Every reader narrows `unknown` itself, because an entry written by an older
 * API could be shaped differently and a crash in history is worse than a blank.
 */

const LABEL: Record<TaskActivityField, string> = {
  title: "Title",
  description: "Description",
  type: "Type",
  status: "Status",
  priority: "Priority",
  assignee: "Assignee",
  dueDate: "Due date",
  storyPoints: "Story points",
  tags: "Tags",
  parent: "Parent task",
  attachments: "Files",
  properties: "Properties",
};

const named = (value: unknown, key: "name" | "key") =>
  value && typeof value === "object" && key in value ? String((value as Record<string, unknown>)[key]) : null;

/** A snapshot value as words, or `null` for "empty". */
function show(field: TaskActivityField, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  switch (field) {
    case "status":
    case "assignee":
      return named(value, "name");
    case "parent":
      return named(value, "key");
    case "priority":
      return PROJECT_PRIORITY_LABEL[value as ProjectPriority] ?? String(value);
    case "type":
      return TASK_TYPE_LABEL[value as TaskType] ?? String(value);
    case "dueDate":
      return typeof value === "string" ? formatDate(value) : null;
    case "tags":
      return Array.isArray(value) && value.length > 0 ? value.join(", ") : null;
    case "title":
      return `“${String(value)}”`;
    default:
      return String(value);
  }
}

export function describeActivity(entry: TaskActivity): string {
  if (entry.action === "created") return "created this task";
  if (entry.action === "commented") return "commented";
  if (!entry.field) return "updated this task";

  const label = LABEL[entry.field] ?? entry.field;

  /* Recorded as "it changed" only — the API keeps no copy of the text. */
  if (entry.field === "description" || entry.field === "properties") {
    return `updated ${label.toLowerCase()}`;
  }

  const from = show(entry.field, entry.from);
  const to = show(entry.field, entry.to);

  if (to && !from) return `set ${label} to ${to}`;
  if (from && !to) return `cleared ${label} (was ${from})`;
  return `changed ${label} from ${from} to ${to}`;
}
