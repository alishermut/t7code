/**
 * Project-scoped task backlog.
 *
 * Distinct from turn-local provider todos (`turn.plan.updated`): those are
 * in-memory progress for the current turn. These records persist on the
 * environment and are shared by every session in a project.
 *
 * @module projectTasks
 */
import * as Schema from "effect/Schema";

import {
  IsoDateTime,
  ProjectId,
  ProjectTaskId,
  ThreadId,
  TrimmedNonEmptyString,
  TrimmedString,
} from "./baseSchemas.ts";

export const ProjectTaskStatus = Schema.Literals(["open", "doing", "blocked", "done"]);
export type ProjectTaskStatus = typeof ProjectTaskStatus.Type;

export const PROJECT_TASK_STATUSES = ["open", "doing", "blocked", "done"] as const;

export const ProjectTask = Schema.Struct({
  id: ProjectTaskId,
  projectId: ProjectId,
  title: TrimmedNonEmptyString.check(Schema.isMaxLength(200)),
  notes: TrimmedString.check(Schema.isMaxLength(4000)),
  status: ProjectTaskStatus,
  parentId: Schema.NullOr(ProjectTaskId),
  claimedThreadId: Schema.NullOr(ThreadId),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type ProjectTask = typeof ProjectTask.Type;

export const ProjectTaskListInput = Schema.Struct({
  projectId: ProjectId,
});
export type ProjectTaskListInput = typeof ProjectTaskListInput.Type;

export const ProjectTaskListResult = Schema.Struct({
  tasks: Schema.Array(ProjectTask),
});
export type ProjectTaskListResult = typeof ProjectTaskListResult.Type;

export const ProjectTaskCreateInput = Schema.Struct({
  projectId: ProjectId,
  title: TrimmedNonEmptyString.check(Schema.isMaxLength(200)),
  notes: Schema.optional(TrimmedString.check(Schema.isMaxLength(4000))),
  parentId: Schema.optional(Schema.NullOr(ProjectTaskId)),
  status: Schema.optional(ProjectTaskStatus),
});
export type ProjectTaskCreateInput = typeof ProjectTaskCreateInput.Type;

export const ProjectTaskUpdateInput = Schema.Struct({
  projectId: ProjectId,
  id: ProjectTaskId,
  title: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(200))),
  notes: Schema.optional(TrimmedString.check(Schema.isMaxLength(4000))),
  status: Schema.optional(ProjectTaskStatus),
  parentId: Schema.optional(Schema.NullOr(ProjectTaskId)),
  claimedThreadId: Schema.optional(Schema.NullOr(ThreadId)),
});
export type ProjectTaskUpdateInput = typeof ProjectTaskUpdateInput.Type;

export class ProjectTaskError extends Schema.TaggedErrorClass<ProjectTaskError>()(
  "ProjectTaskError",
  {
    reason: Schema.Literals([
      "not_found",
      "project_missing",
      "parent_missing",
      "cycle",
      "persist_failed",
    ]),
    detail: TrimmedNonEmptyString,
  },
) {
  override get message(): string {
    return `Project task failed (${this.reason}): ${this.detail}`;
  }
}
