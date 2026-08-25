/**
 * Durable project-scoped task backlog.
 *
 * Lives in T3 userdata (`project-tasks.json`), not in the git workspace, so
 * agents and humans share one list without polluting the repo.
 *
 * @module ProjectTaskStore
 */
import {
  ProjectId,
  ProjectTaskError,
  ProjectTaskId,
  type ProjectTask,
  type ProjectTaskCreateInput,
  type ProjectTaskCreateResult,
  type ProjectTaskDeleteInput,
  type ProjectTaskDeleteResult,
  type ProjectTaskUpdateInput,
  type ThreadId,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as SynchronizedRef from "effect/SynchronizedRef";

import { writeFileStringAtomically } from "../atomicWrite.ts";
import { ServerConfig } from "../config.ts";
import {
  claimProjectTask,
  createProjectTask,
  deleteProjectTask,
  EMPTY_PROJECT_TASK_DOCUMENT,
  listProjectTasks,
  updateProjectTask,
  type ProjectTaskDocument,
} from "./projectTaskState.ts";

const StoredTask = Schema.Struct({
  id: ProjectTaskId,
  projectId: ProjectId,
  title: Schema.String,
  notes: Schema.String,
  status: Schema.Literals(["open", "doing", "review", "blocked", "done"]),
  parentId: Schema.NullOr(ProjectTaskId),
  claimedThreadId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

const ProjectTaskDocumentSchema = Schema.Struct({
  version: Schema.Literal(1),
  tasks: Schema.Array(StoredTask),
});

const decodeDocumentJson = Schema.decodeUnknownSync(
  Schema.fromJsonString(ProjectTaskDocumentSchema),
);
const encodeDocumentJson = Schema.encodeSync(Schema.fromJsonString(ProjectTaskDocumentSchema));
const isProjectTaskError = Schema.is(ProjectTaskError);

/**
 * Outcome of reading `project-tasks.json`.
 *
 * `Unreadable` is deliberately distinct from `Empty`. A file we cannot decode
 * still holds someone's backlog, so callers have to preserve those bytes
 * instead of starting empty and writing over them on the next mutation.
 */
export type ProjectTaskDocumentRead =
  | { readonly _tag: "Empty" }
  | { readonly _tag: "Loaded"; readonly document: ProjectTaskDocument }
  | { readonly _tag: "Unreadable"; readonly detail: string };

export const readProjectTaskDocument = (raw: string): ProjectTaskDocumentRead => {
  if (raw.trim().length === 0) {
    return { _tag: "Empty" };
  }
  try {
    const parsed = decodeDocumentJson(raw);
    return {
      _tag: "Loaded",
      document: {
        version: 1,
        tasks: parsed.tasks.map((task) => ({
          ...task,
          claimedThreadId: task.claimedThreadId as ProjectTask["claimedThreadId"],
        })),
      },
    };
  } catch (error) {
    return {
      _tag: "Unreadable",
      detail: error instanceof Error ? error.message : "Could not decode project tasks.",
    };
  }
};

/** Filesystem-safe stamp for a quarantined document, derived from an ISO timestamp. */
const quarantineStamp = (nowIso: string): string => nowIso.replace(/[:.]/g, "-");

export interface ProjectTaskStoreShape {
  readonly list: (
    projectId: ProjectId,
  ) => Effect.Effect<ReadonlyArray<ProjectTask>, ProjectTaskError>;
  readonly create: (
    input: ProjectTaskCreateInput,
  ) => Effect.Effect<ProjectTaskCreateResult, ProjectTaskError>;
  readonly update: (input: ProjectTaskUpdateInput) => Effect.Effect<ProjectTask, ProjectTaskError>;
  readonly remove: (
    input: ProjectTaskDeleteInput,
  ) => Effect.Effect<ProjectTaskDeleteResult, ProjectTaskError>;
  readonly claim: (input: {
    readonly projectId: ProjectId;
    readonly id: ProjectTaskId;
    readonly threadId: ThreadId;
  }) => Effect.Effect<ProjectTask, ProjectTaskError>;

  /**
   * The project's tasks, now and after every change.
   *
   * Agents write this list continuously once the policy is injected, so a board
   * that only refetched after its own mutation would show stale work. Emits the
   * current list immediately so a subscriber needs no separate initial read.
   */
  readonly changes: (projectId: ProjectId) => Stream.Stream<ReadonlyArray<ProjectTask>>;
}

export class ProjectTaskStore extends Context.Service<ProjectTaskStore, ProjectTaskStoreShape>()(
  "t3/projectTasks/ProjectTaskStore",
) {}

export const make = (
  initial: ProjectTaskDocument,
  persist: ((document: ProjectTaskDocument) => Effect.Effect<void, ProjectTaskError>) | null,
): Effect.Effect<ProjectTaskStoreShape, never, Crypto.Crypto> =>
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    const state = yield* SynchronizedRef.make(initial);
    // Mutations serialize through `state`; `published` exists so subscribers get
    // the current list and every later one with no gap between the two.
    const published = yield* SubscriptionRef.make(initial);
    const nowIso = Effect.map(DateTime.now, DateTime.formatIso);
    const mutate = <A>(
      rewrite: (
        document: ProjectTaskDocument,
        now: string,
        id: ProjectTaskId,
      ) => { readonly document: ProjectTaskDocument; readonly result: A },
    ) =>
      SynchronizedRef.modifyEffect(state, (document) =>
        Effect.gen(function* () {
          const now = yield* nowIso;
          const id = ProjectTaskId.make(yield* crypto.randomUUIDv4.pipe(Effect.orDie));
          const next = yield* Effect.try({
            try: () => rewrite(document, now, id),
            catch: (error) =>
              isProjectTaskError(error)
                ? error
                : new ProjectTaskError({
                    reason: "persist_failed",
                    detail: error instanceof Error ? error.message : "Unknown task error.",
                  }),
          });
          if (persist) {
            yield* persist(next.document);
          }
          yield* SubscriptionRef.set(published, next.document);
          return [next.result, next.document] as const;
        }),
      );

    return {
      list: (projectId) =>
        SynchronizedRef.get(state).pipe(
          Effect.map((document) => listProjectTasks(document, projectId)),
        ),
      create: (input) => mutate((document, now, id) => createProjectTask(document, input, now, id)),
      update: (input) => mutate((document, now) => updateProjectTask(document, input, now)),
      remove: (input) =>
        mutate((document, now) => deleteProjectTask(document, input.projectId, input.id, now)),
      claim: (input) =>
        mutate((document, now) =>
          claimProjectTask(document, input.projectId, input.id, input.threadId, now),
        ),
      changes: (projectId) =>
        SubscriptionRef.changes(published).pipe(
          Stream.map((document) => listProjectTasks(document, projectId)),
        ),
    };
  });

export const layerMemory = Layer.effect(ProjectTaskStore, make(EMPTY_PROJECT_TASK_DOCUMENT, null));

export const layer = Layer.effect(
  ProjectTaskStore,
  Effect.gen(function* () {
    const config = yield* ServerConfig;
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const filePath = path.join(config.stateDir, "project-tasks.json");
    const raw = yield* fs.readFileString(filePath).pipe(Effect.orElseSucceed(() => ""));
    const persist = (document: ProjectTaskDocument) =>
      writeFileStringAtomically({
        filePath,
        contents: `${encodeDocumentJson(document)}\n`,
      }).pipe(
        Effect.mapError(
          (error) =>
            new ProjectTaskError({
              reason: "persist_failed",
              detail: error instanceof Error ? error.message : "Could not write project tasks.",
            }),
        ),
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
      );

    const read = readProjectTaskDocument(raw);
    if (read._tag !== "Unreadable") {
      return yield* make(
        read._tag === "Loaded" ? read.document : EMPTY_PROJECT_TASK_DOCUMENT,
        persist,
      );
    }

    // Move the undecodable bytes aside before this process can write over
    // them. If even that fails we run without persistence, so a decode bug can
    // never destroy the only copy of someone's backlog.
    const stamp = quarantineStamp(yield* Effect.map(DateTime.now, DateTime.formatIso));
    const quarantinePath = path.join(config.stateDir, `project-tasks.unreadable-${stamp}.json`);
    const preserved = yield* fs.rename(filePath, quarantinePath).pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false),
    );
    if (!preserved) {
      yield* Effect.logError(
        "Could not read or preserve project tasks; continuing without persistence.",
        { filePath, detail: read.detail },
      );
      return yield* make(EMPTY_PROJECT_TASK_DOCUMENT, null);
    }
    yield* Effect.logError(
      "Could not read project tasks; moved the file aside and started an empty backlog.",
      { filePath, quarantinePath, detail: read.detail },
    );
    return yield* make(EMPTY_PROJECT_TASK_DOCUMENT, persist);
  }),
);
