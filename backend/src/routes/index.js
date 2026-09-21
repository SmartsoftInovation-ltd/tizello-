// The single mount point for every route in the app. app.js mounts this
// router and nothing else, so adding a module means one import and one
// `router.use(...)` line here — never an edit to app.js.

import express from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from "../modules/auth/auth.routes.js";
import {
  workspaceRouter as invitationWorkspaceRoutes,
  tokenRouter as invitationTokenRoutes,
} from "../modules/invitation/invitation.routes.js";
import {
  workspaceRouter as projectWorkspaceRoutes,
  projectRouter as projectRoutes,
} from "../modules/project/project.routes.js";
import memberRoutes from "../modules/member/member.routes.js";
import searchRoutes from "../modules/search/search.routes.js";
import trashRoutes from "../modules/trash/trash.routes.js";
import projectPropertyRoutes from "../modules/project/project-property.routes.js";
import {
  projectRouter as sprintProjectRoutes,
  sprintRouter as sprintRoutes,
} from "../modules/sprint/sprint.routes.js";
import {
  projectRouter as taskProjectRoutes,
  taskRouter as taskRoutes,
} from "../modules/task/task.routes.js";
import taskActivityRoutes from "../modules/task/task-activity.routes.js";
import taskCommentRoutes from "../modules/task/task-comment.routes.js";
import roleRoutes from "../modules/role/role.routes.js";
import taskPropertyRoutes from "../modules/task/task-property.routes.js";
import taskStatusRoutes from "../modules/task/task-status.routes.js";
import uploadRoutes from "../modules/upload/upload.routes.js";
import userRoutes from "../modules/user/user.routes.js";
import workspaceRoutes from "../modules/workspace/workspace.routes.js";

const router = express.Router();

// Health first, and outside the /api/v1 prefix: probes must not depend on
// versioned API routing, and keeping it ahead of everything else means no
// auth or rate-limit middleware added later can accidentally shadow it.
router.use('/health', healthRoutes);

// --- Feature module routes ---
// Each module owns one line. Keep them alphabetical.
router.use("/api/v1/auth", authRoutes);
// Two mounts, one module: admin routes are workspace-scoped because the
// permission middleware resolves a membership from (userId, workspaceId), and
// recipient routes are token-scoped because the recipient has no membership yet.
router.use("/api/v1/invitations", invitationTokenRoutes);
// Two mounts, one module, for the same reason invitations need two: create and
// list are workspace-scoped because the permission middleware resolves a
// membership from (userId, workspaceId); everything else is addressed by the
// project's own globally unique id.
router.use("/api/v1/projects", projectRoutes);
// A project's task database: its rows and its per-project columns. Nested under
// the project because both need `loadProject` to resolve the caller's roles —
// on create there is no task yet to authorise against. These paths fall through
// `projectRoutes` above, whose routes all match `/:projectId` exactly or name
// their own sub-path (`/members`, `/archive`).
router.use("/api/v1/projects/:projectId/task-properties", taskPropertyRoutes);
// The project's workflow: its editable statuses, grouped To-do / In progress /
// Complete. Project-scoped for the same `loadProject` reason as the two beside it.
router.use("/api/v1/projects/:projectId/task-statuses", taskStatusRoutes);
router.use("/api/v1/projects/:projectId/tasks", taskProjectRoutes);
// A project's sprints — the time-boxes its tasks are planned into. Create and
// list are project-scoped; everything else is addressed by the sprint's own id.
router.use("/api/v1/projects/:projectId/sprints", sprintProjectRoutes);
router.use("/api/v1/sprints", sprintRoutes);
// Cross-cutting, so it is mounted flat rather than under a workspace or a
// project: its scope is every workspace the caller belongs to, resolved from
// the session. docs/api/search.md.
router.use("/api/v1/search", searchRoutes);
// Cross-cutting like search, and mounted flat for the same reason: the trash
// is not a place inside a workspace or a project, it is everything of the
// caller's that is gone. docs/api/trash.md.
router.use("/api/v1/trash", trashRoutes);
// Everything else about a task is addressed by the task's own id — same
// two-scope split as projects. Comments are their own router so the task
// routes file lists tasks and nothing else.
router.use("/api/v1/tasks", taskRoutes);
router.use("/api/v1/tasks/:taskId/activity", taskActivityRoutes);
router.use("/api/v1/tasks/:taskId/comments", taskCommentRoutes);
router.use("/api/v1/workspaces/:workspaceId/invitations", invitationWorkspaceRoutes);
// The roster and its writes. Workspace-scoped because `permission.js` resolves
// the caller's membership from (userId, workspaceId). The GET moved here from
// the workspace module unchanged — same path, same response — because the
// roster's writes live in the member module, and a resource whose read is in
// one module and whose writes are in another has two owners and therefore none.
router.use("/api/v1/workspaces/:workspaceId/members", memberRoutes);
// The workspace's own roles and the permission catalog they are defined
// against. Workspace-scoped for the same reason the roster is: a role belongs
// to one workspace, and `permission.js` needs the id in the path to resolve who
// is asking.
router.use("/api/v1/workspaces/:workspaceId/roles", roleRoutes);
router.use("/api/v1/workspaces/:workspaceId/projects", projectWorkspaceRoutes);
// The workspace's project-database schema. Workspace-scoped rather than
// project-scoped because a definition belongs to the workspace: adding one
// adds the column to every project in it.
router.use("/api/v1/workspaces/:workspaceId/properties", projectPropertyRoutes);
// Not workspace-scoped: a file is uploaded before it is attached to anything.
router.use("/api/v1/uploads", uploadRoutes);
router.use("/api/v1/users", userRoutes);
router.use("/api/v1/workspaces", workspaceRoutes);

export default router;
