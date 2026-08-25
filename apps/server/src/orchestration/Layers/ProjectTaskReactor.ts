/**
 * ProjectTaskReactorLive - Advances claimed backlog tasks off turn outcomes.
 *
 * The rule is deliberately narrow: a turn that lands file changes moves the
 * task it claimed from `doing` to `review`. Nothing here asks the model to
 * remember anything, so it behaves the same on Codex, Claude, Cursor, Grok, and
 * OpenCode.
 *
 * Deciding *which* task is claimed reads the store rather than watching
 * `item.completed` for `tasks_claim`. The store is already the record of what
 * the agent did, so watching the tool calls that wrote it would be a second,
 * less reliable copy of the same fact.
 *
 * @module ProjectTaskReactorLive
 */
import type { ProviderRuntimeEvent, ThreadId } from "@t3tools/contracts";
import { makeDrainableWorker } from "@t3tools/shared/DrainableWorker";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";

import { ProviderService } from "../../provider/Services/ProviderService.ts";
import * as ProjectTaskStore from "../../projectTasks/ProjectTaskStore.ts";
import { selectTasksToReview } from "../../projectTasks/projectTaskState.ts";
import { ProjectionSnapshotQuery } from "../Services/ProjectionSnapshotQuery.ts";
import {
  ProjectTaskReactor,
  type ProjectTaskReactorShape,
} from "../Services/ProjectTaskReactor.ts";
import { forkParked } from "../../serverActivation.ts";

/** Runtime events this reactor acts on. Everything else is ignored cheaply. */
const HANDLED_EVENT_TYPES = new Set(["turn.started", "turn.diff.updated", "turn.completed"]);

export const make = Effect.gen(function* () {
  const providerService = yield* ProviderService;
  const projectionSnapshotQuery = yield* ProjectionSnapshotQuery;
  const store = yield* ProjectTaskStore.ProjectTaskStore;

  /**
   * Whether the in-flight turn has produced a diff yet, keyed by thread.
   * `turn.diff.updated` can arrive several times per turn; only its
   * emptiness matters.
   */
  const turnLandedChanges = new Map<ThreadId, boolean>();

  const advanceClaimedTasks = Effect.fn("advanceClaimedTasks")(function* (threadId: ThreadId) {
    const thread = yield* projectionSnapshotQuery.getThreadShellById(threadId);
    if (Option.isNone(thread)) {
      return;
    }
    const projectId = thread.value.projectId;
    const claimed = selectTasksToReview({
      tasks: yield* store.list(projectId),
      threadId,
      landedChanges: true,
    });
    for (const task of claimed) {
      yield* store.update({ projectId, id: task.id, status: "review" });
      yield* Effect.logInfo("project task moved to review after a turn landed changes", {
        threadId,
        taskId: task.id,
      });
    }
  });

  const processEvent = Effect.fn("processProjectTaskEvent")(function* (
    event: ProviderRuntimeEvent,
  ) {
    const threadId = event.threadId;
    if (threadId === undefined) {
      return;
    }
    switch (event.type) {
      case "turn.started": {
        turnLandedChanges.set(threadId, false);
        return;
      }
      case "turn.diff.updated": {
        if (event.payload.unifiedDiff.trim().length > 0) {
          turnLandedChanges.set(threadId, true);
        }
        return;
      }
      case "turn.completed": {
        const landedChanges = turnLandedChanges.get(threadId) ?? false;
        turnLandedChanges.delete(threadId);
        if (!landedChanges) {
          return;
        }
        yield* advanceClaimedTasks(threadId);
        return;
      }
      default:
        return;
    }
  });

  const processEventSafely = (event: ProviderRuntimeEvent) =>
    processEvent(event).pipe(
      Effect.catchCause((cause) => {
        if (Cause.hasInterruptsOnly(cause)) {
          return Effect.failCause(cause);
        }
        return Effect.logWarning("project task reactor failed to process event", {
          eventType: event.type,
          threadId: event.threadId,
          cause: Cause.pretty(cause),
        });
      }),
    );

  const worker = yield* makeDrainableWorker(processEventSafely);

  const start: ProjectTaskReactorShape["start"] = Effect.fn("start")(function* () {
    yield* forkParked(
      Stream.runForEach(providerService.streamEvents, (event) =>
        HANDLED_EVENT_TYPES.has(event.type) ? worker.enqueue(event) : Effect.void,
      ),
    );
  });

  return {
    start,
    drain: worker.drain,
  } satisfies ProjectTaskReactorShape;
});

export const ProjectTaskReactorLive = Layer.effect(ProjectTaskReactor, make);
