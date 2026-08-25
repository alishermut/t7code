import {
  ProjectTask,
  ProjectTaskCreateResult,
  ProjectTaskDeleteResult,
  ProjectTaskError,
  ProjectTaskId,
  ProjectTaskStatus,
  TrimmedNonEmptyString,
  TrimmedString,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as ProjectionSnapshotQuery from "../../../orchestration/Services/ProjectionSnapshotQuery.ts";
import * as ProjectTaskHealth from "../../../projectTasks/ProjectTaskHealth.ts";
import * as ProjectTaskStore from "../../../projectTasks/ProjectTaskStore.ts";

const dependencies = [
  McpInvocationContext.McpInvocationContext,
  ProjectTaskStore.ProjectTaskStore,
  ProjectTaskHealth.ProjectTaskHealth,
  ProjectionSnapshotQuery.ProjectionSnapshotQuery,
];

const BACKLOG_PREAMBLE =
  "Project backlog, not this turn's private todo list. Use this for long-horizon work the team should keep after the session ends. Do not confuse it with TodoWrite or provider plan steps.";

const describedString = <S extends Schema.Top>(schema: S, description: string) =>
  Schema.String.annotate({ description }).pipe(Schema.decodeTo(schema));

const TaskTitle = describedString(
  TrimmedNonEmptyString.check(Schema.isMaxLength(200)),
  "Short name for the goal or task.",
);
const TaskNotes = TrimmedString.check(Schema.isMaxLength(4000));

export const TasksListTool = Tool.make("tasks_list", {
  description: `${BACKLOG_PREAMBLE} List open, doing, review, blocked, and done tasks for the current project.`,
  parameters: Schema.Struct({
    status: Schema.optional(
      ProjectTaskStatus.annotate({
        description:
          "If set, only return tasks with this status: open, doing, review, blocked, or done.",
      }),
    ),
  }),
  // Deliberately not the wire result: reachability data on that shape is for
  // the operator looking at the Tasks board, not for the agent.
  success: Schema.Struct({ tasks: Schema.Array(ProjectTask) }),
  failure: ProjectTaskError,
  dependencies,
})
  .annotate(Tool.Title, "List project tasks")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true);

export const TasksCreateTool = Tool.make("tasks_create", {
  description: `${BACKLOG_PREAMBLE} Create a backlog item. Pass parentId to split a goal into a child task. If an unfinished task in this project already has the same title, that task is returned instead and \`matchedExisting\` is true — do not retry with a reworded title.`,
  parameters: Schema.Struct({
    title: TaskTitle,
    notes: Schema.optional(TaskNotes).annotate({
      description: "Optional detail, acceptance criteria, or context the next session will need.",
    }),
    parentId: Schema.optional(
      Schema.NullOr(ProjectTaskId).annotate({
        description:
          "Existing task to nest this under when splitting a goal. Omit for a top-level item.",
      }),
    ),
    status: Schema.optional(
      ProjectTaskStatus.annotate({
        description: "Initial status. Defaults to open.",
      }),
    ),
  }),
  success: ProjectTaskCreateResult,
  failure: ProjectTaskError,
  dependencies,
})
  .annotate(Tool.Title, "Create project task")
  .annotate(Tool.Destructive, false);

export const TasksUpdateTool = Tool.make("tasks_update", {
  description: `${BACKLOG_PREAMBLE} Update a backlog item's title, notes, status (open|doing|review|blocked|done), or parent.`,
  parameters: Schema.Struct({
    id: describedString(ProjectTaskId, "Task to update."),
    title: Schema.optional(TaskTitle).annotate({
      description: "Replacement title.",
    }),
    notes: Schema.optional(TaskNotes).annotate({
      description: "Replacement notes. Pass an empty string to clear them.",
    }),
    status: Schema.optional(
      ProjectTaskStatus.annotate({
        description: "open, doing, review, blocked, or done.",
      }),
    ),
    parentId: Schema.optional(
      Schema.NullOr(ProjectTaskId).annotate({
        description: "Move this task under another task, or null to make it top-level.",
      }),
    ),
  }),
  success: ProjectTask,
  failure: ProjectTaskError,
  dependencies,
})
  .annotate(Tool.Title, "Update project task")
  .annotate(Tool.Idempotent, true);

export const TasksClaimTool = Tool.make("tasks_claim", {
  description: `${BACKLOG_PREAMBLE} Claim a task for this session and mark it doing.`,
  parameters: Schema.Struct({
    id: describedString(ProjectTaskId, "Task this session will work on."),
  }),
  success: ProjectTask,
  failure: ProjectTaskError,
  dependencies,
})
  .annotate(Tool.Title, "Claim project task")
  .annotate(Tool.Destructive, false);

export const TasksDeleteTool = Tool.make("tasks_delete", {
  description: `${BACKLOG_PREAMBLE} Permanently remove a backlog item. Child tasks are kept and promoted to top level. Use this for items filed by mistake — finished work belongs in status done, not deleted.`,
  parameters: Schema.Struct({
    id: describedString(ProjectTaskId, "Task to delete."),
  }),
  success: ProjectTaskDeleteResult,
  failure: ProjectTaskError,
  dependencies,
})
  .annotate(Tool.Title, "Delete project task")
  .annotate(Tool.Destructive, true);

export const TasksToolkit = Toolkit.make(
  TasksListTool,
  TasksCreateTool,
  TasksUpdateTool,
  TasksDeleteTool,
  TasksClaimTool,
);
