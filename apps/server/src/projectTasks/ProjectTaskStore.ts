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
import * as SynchronizedRef from "effect/SynchronizedRef";

import { writeFileStringAtomically } from "../atomicWrite.ts";
import { ServerConfig } from "../config.ts";
import {
  claimProjectTask,
  createProjectTask,
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
  status: Schema.Literals(["open", "doing", "blocked", "done"]),
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

const sanitizeDocument = (raw: string): ProjectTaskDocument => {
  if (raw.trim().length === 0) {
    return EMPTY_PROJECT_TASK_DOCUMENT;
  }
  try {
    const parsed = decodeDocumentJson(raw);
    return {
      version: 1,
      tasks: parsed.tasks.map((task) => ({
        ...task,
        claimedThreadId: task.claimedThreadId as ProjectTask["claimedThreadId"],
      })),
    };
  } catch {
    return EMPTY_PROJECT_TASK_DOCUMENT;
  }
};

export interface ProjectTaskStoreShape {
  readonly list: (
    projectId: ProjectId,
  ) => Effect.Effect<ReadonlyArray<ProjectTask>, ProjectTaskError>;
  readonly create: (input: ProjectTaskCreateInput) => Effect.Effect<ProjectTask, ProjectTaskError>;
  readonly update: (input: ProjectTaskUpdateInput) => Effect.Effect<ProjectTask, ProjectTaskError>;
  readonly claim: (input: {
    readonly projectId: ProjectId;
    readonly id: ProjectTaskId;
    readonly threadId: ThreadId;
  }) => Effect.Effect<ProjectTask, ProjectTaskError>;
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
    const nowIso = Effect.map(DateTime.now, DateTime.formatIso);
    const mutate = <A>(
      rewrite: (
        document: ProjectTaskDocument,
        now: string,
        id: ProjectTaskId,
      ) => { readonly document: ProjectTaskDocument; readonly task: A },
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
          return [next.task, next.document] as const;
        }),
      );

    return {
      list: (projectId) =>
        SynchronizedRef.get(state).pipe(
          Effect.map((document) => listProjectTasks(document, projectId)),
        ),
      create: (input) => mutate((document, now, id) => createProjectTask(document, input, now, id)),
      update: (input) => mutate((document, now) => updateProjectTask(document, input, now)),
      claim: (input) =>
        mutate((document, now) =>
          claimProjectTask(document, input.projectId, input.id, input.threadId, now),
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
    const initial = sanitizeDocument(raw);
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
    return yield* make(initial, persist);
  }),
);
