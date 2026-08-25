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
import { ProviderInstanceId } from "./providerInstance.ts";

/**
 * `review` sits between "the work happened" and "the work is accepted". T3
 * moves a claimed task into it when a turn lands a checkpoint, so it marks work
 * awaiting confirmation rather than work an agent declared finished.
 */
export const ProjectTaskStatus = Schema.Literals(["open", "doing", "review", "blocked", "done"]);
export type ProjectTaskStatus = typeof ProjectTaskStatus.Type;

export const PROJECT_TASK_STATUSES = ["open", "doing", "review", "blocked", "done"] as const;

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

/**
 * Evidence that a provider can still reach the backlog toolkit.
 *
 * This records real use, not capability: it answers "did this provider session
 * successfully call a `tasks_*` tool, and when". That is what actually breaks
 * when a provider update stops surfacing the MCP tools, and it needs no
 * cooperation from any adapter.
 */
export const ProjectTaskHealthEntry = Schema.Struct({
  providerInstanceId: ProviderInstanceId,
  lastTool: TrimmedNonEmptyString,
  lastToolAt: IsoDateTime,
});
export type ProjectTaskHealthEntry = typeof ProjectTaskHealthEntry.Type;

export const ProjectTaskListResult = Schema.Struct({
  tasks: Schema.Array(ProjectTask),
  /**
   * Reachability rides along with the list rather than on its own method. The
   * Tasks board is the only surface that wants it and already lists, so a
   * separate call would be a second round trip for data nobody reads alone.
   */
  health: Schema.Array(ProjectTaskHealthEntry),
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

/**
 * Creation is deduplicated against the project's unfinished tasks, so callers
 * have to be told whether they got a new record or an existing one. Agents
 * re-describe the same work in different words constantly; leaving the match to
 * the caller produces a backlog full of near-duplicates.
 */
export const ProjectTaskCreateResult = Schema.Struct({
  task: ProjectTask,
  matchedExisting: Schema.Boolean,
});
export type ProjectTaskCreateResult = typeof ProjectTaskCreateResult.Type;

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

export const ProjectTaskDeleteInput = Schema.Struct({
  projectId: ProjectId,
  id: ProjectTaskId,
});
export type ProjectTaskDeleteInput = typeof ProjectTaskDeleteInput.Type;

/**
 * Children of a deleted task are promoted to top level rather than deleted with
 * it. Cascading would let one click destroy work the caller never named.
 */
export const ProjectTaskDeleteResult = Schema.Struct({
  id: ProjectTaskId,
  promotedChildIds: Schema.Array(ProjectTaskId),
});
export type ProjectTaskDeleteResult = typeof ProjectTaskDeleteResult.Type;

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
