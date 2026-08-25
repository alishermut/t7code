import { ProjectTaskError, type ProjectTask } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as ProjectionSnapshotQuery from "../../../orchestration/Services/ProjectionSnapshotQuery.ts";
import * as ProjectTaskHealth from "../../../projectTasks/ProjectTaskHealth.ts";
import * as ProjectTaskStore from "../../../projectTasks/ProjectTaskStore.ts";
import { TasksToolkit } from "./tools.ts";

const requireProjectId = Effect.fn("TasksToolkit.requireProjectId")(function* () {
  const invocation = yield* McpInvocationContext.McpInvocationContext;
  const snapshots = yield* ProjectionSnapshotQuery.ProjectionSnapshotQuery;
  const thread = yield* snapshots.getThreadShellById(invocation.threadId).pipe(
    Effect.mapError(
      () =>
        new ProjectTaskError({
          reason: "project_missing",
          detail: "Could not read this session's project.",
        }),
    ),
  );
  if (Option.isNone(thread)) {
    return yield* new ProjectTaskError({
      reason: "project_missing",
      detail: "This session is not attached to a project.",
    });
  }
  return thread.value.projectId;
});

/**
 * Every backlog tool call is evidence the toolkit reached this provider. Record
 * it once, here, rather than in five handlers that would drift apart.
 */
const recordReach = Effect.fn("TasksToolkit.recordReach")(function* (
  tool: ProjectTaskHealth.ProjectTaskToolName,
) {
  const invocation = yield* McpInvocationContext.McpInvocationContext;
  const health = yield* ProjectTaskHealth.ProjectTaskHealth;
  yield* health.recordToolUse({ providerInstanceId: invocation.providerInstanceId, tool });
});

const handlers = {
  tasks_list: (input) =>
    Effect.gen(function* () {
      yield* recordReach("tasks_list");
      const projectId = yield* requireProjectId();
      const store = yield* ProjectTaskStore.ProjectTaskStore;
      const tasks = yield* store.list(projectId);
      return {
        tasks:
          input.status === undefined ? tasks : tasks.filter((task) => task.status === input.status),
      };
    }),
  tasks_create: (input) =>
    Effect.gen(function* () {
      yield* recordReach("tasks_create");
      const projectId = yield* requireProjectId();
      const store = yield* ProjectTaskStore.ProjectTaskStore;
      return yield* store.create({
        projectId,
        title: input.title,
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
        ...(input.status === undefined ? {} : { status: input.status }),
      });
    }),
  tasks_update: (input) =>
    Effect.gen(function* () {
      yield* recordReach("tasks_update");
      const projectId = yield* requireProjectId();
      const store = yield* ProjectTaskStore.ProjectTaskStore;
      return yield* store.update({
        projectId,
        id: input.id,
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
      });
    }),
  tasks_delete: (input) =>
    Effect.gen(function* () {
      yield* recordReach("tasks_delete");
      const projectId = yield* requireProjectId();
      const store = yield* ProjectTaskStore.ProjectTaskStore;
      return yield* store.remove({ projectId, id: input.id });
    }),
  tasks_claim: (input) =>
    Effect.gen(function* () {
      yield* recordReach("tasks_claim");
      const invocation = yield* McpInvocationContext.McpInvocationContext;
      const projectId = yield* requireProjectId();
      const store = yield* ProjectTaskStore.ProjectTaskStore;
      return yield* store.claim({
        projectId,
        id: input.id,
        threadId: invocation.threadId,
      });
    }),
} satisfies Parameters<typeof TasksToolkit.toLayer>[0];

export const TasksToolkitHandlersLive = TasksToolkit.toLayer(handlers);

export type { ProjectTask };
