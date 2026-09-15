"use client";

import { Suspense } from "react";
import { DrawerCloseButton } from "@/components/projects/drawer-title";
import { SurfaceMenu } from "@/components/projects/surface-menu";
import { TaskActivity } from "@/components/tasks/task-activity";
import { TaskComments } from "@/components/tasks/task-comments";
import type { TaskScope } from "@/components/tasks/task-draft";
import { TaskMetaLine } from "@/components/tasks/task-meta-line";
import { TaskPropertyList } from "@/components/tasks/task-property-list";
import { TaskRelations } from "@/components/tasks/task-relations";
import { TaskTitleField } from "@/components/tasks/task-title-field";
import { TaskTopFields } from "@/components/tasks/task-top-fields";
import { useTaskForm } from "@/components/tasks/use-task-form";
import { Button } from "@/components/ui/button";
import { DrawerBody, DrawerFooter, DrawerForm, DrawerHeader } from "@/components/ui/drawer";
import type { listTaskCommentsAction } from "@/lib/actions/task-actions";
import type { ProjectSurface, SurfaceScope } from "@/lib/project-surface";
import type { Task } from "@/types/task";

/**
 * The body of the task panel, top to bottom: the type mark and title, who
 * filed it; Status, Assignee and Due side by side; the property list; then
 * Relations (parent and sub-tasks), Comments and the collapsed Activity log.
 *
 * FIELDS RIDE SAVE, RELATIONS AND COMMENTS DO NOT. A property is part of the
 * task, so it is edited as a draft and written once. A sub-task is another
 * task and a comment is another row — holding either behind this form's Save
 * would mean a comment that exists only in a drawer somebody then cancelled.
 * Both write the moment they are added, which is also why neither renders on
 * a task that does not exist yet.
 */
export function TaskForm({
  task,
  parentId,
  sprintId,
  scope,
  surface,
  surfaceScope,
  tasks,
  commentsPromise,
  onClose,
  onOpenTask,
}: {
  task: Task | null;
  parentId?: string;
  sprintId?: string;
  scope: TaskScope;
  surface: ProjectSurface;
  surfaceScope: SurfaceScope;
  tasks: Task[];
  commentsPromise: ReturnType<typeof listTaskCommentsAction> | null;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  const form = useTaskForm({ task, scope, parentId, sprintId, onClose });
  const readOnly = !scope.canContribute;

  return (
    <DrawerForm onSubmit={form.submit} noValidate>
      <DrawerHeader>
        <p className="min-w-0 flex-1 truncate text-xs text-text-subtle">
          {task ? (
            <span className="font-mono">{task.key}</span>
          ) : (
            `New task in ${scope.sprints.find((sprint) => sprint.id === sprintId)?.name ?? "Backlog"}`
          )}
        </p>
        <SurfaceMenu surface={surface} scope={surfaceScope} />
        <DrawerCloseButton onClose={onClose} />
      </DrawerHeader>

      <DrawerBody className="px-6 py-6">
        <TaskTitleField
          type={form.draft.type}
          defaultValue={form.draft.title}
          error={form.errors.title}
          autoFocus={!task}
          onChange={(title) => form.change({ title })}
        />
        {task && <TaskMetaLine task={task} />}

        <TaskTopFields
          draft={form.draft}
          errors={form.errors}
          scope={scope}
          onChange={form.change}
        />

        <TaskPropertyList
          task={task}
          draft={form.draft}
          properties={form.properties}
          scope={scope}
          onChange={form.change}
          onPropertiesChange={form.changeProperties}
        />

        <TaskRelations
          task={task}
          draft={form.draft}
          scope={scope}
          tasks={tasks}
          onChange={form.change}
          onOpenTask={onOpenTask}
        />

        {task && commentsPromise && (
          <Suspense
            fallback={
              <p className="mt-6 border-t border-border pt-4 text-xs text-text-subtle">
                Loading comments…
              </p>
            }
          >
            <TaskComments task={task} scope={scope} promise={commentsPromise} />
          </Suspense>
        )}

        {task && <TaskActivity key={task.id} taskId={task.id} />}
      </DrawerBody>

      <DrawerFooter>
        {readOnly && (
          <p className="mr-auto text-2xs text-text-subtle">
            Only people on this project can change its tasks.
          </p>
        )}
        <Button type="button" variant="outline" onClick={onClose}>
          {readOnly ? "Close" : "Cancel"}
        </Button>
        {!readOnly && (
          <Button type="submit" disabled={form.isPending}>
            {form.isPending ? "Saving…" : task ? "Save changes" : "Create task"}
          </Button>
        )}
      </DrawerFooter>
    </DrawerForm>
  );
}
