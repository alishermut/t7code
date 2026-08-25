import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { ProjectId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";

import * as ServerConfig from "../config.ts";
import * as ProjectTaskStore from "./ProjectTaskStore.ts";

const projectId = ProjectId.make("project-1");

const UNREADABLE = '{"version":1,"tasks":[{"id":';

/** Stored-document fixture. Written as literal JSON so the test pins real bytes. */
const storedDocument = (title: string): string =>
  [
    '{"version":1,"tasks":[{',
    '"id":"task-1",',
    '"projectId":"project-1",',
    `"title":"${title}",`,
    '"notes":"",',
    '"status":"open",',
    '"parentId":null,',
    '"claimedThreadId":null,',
    '"createdAt":"2026-01-01T00:00:00.000Z",',
    '"updatedAt":"2026-01-01T00:00:00.000Z"',
    "}]}",
  ].join("");

const withStateDir = (prefix: string) =>
  Effect.provide(ServerConfig.layerTest(process.cwd(), { prefix }));

/** Build the persistent store against the ambient test `stateDir`. */
const openStore = Effect.provide(
  Effect.service(ProjectTaskStore.ProjectTaskStore),
  ProjectTaskStore.layer,
);

const stateDirFile = Effect.fn("stateDirFile")(function* (name: string) {
  const config = yield* ServerConfig.ServerConfig;
  const path = yield* Path.Path;
  return path.join(config.stateDir, name);
});

describe("readProjectTaskDocument", () => {
  it("reads blank contents as an empty backlog", () => {
    expect(ProjectTaskStore.readProjectTaskDocument("   ")._tag).toBe("Empty");
  });

  it("reads a well-formed document", () => {
    const read = ProjectTaskStore.readProjectTaskDocument(storedDocument("Ship auth"));
    expect(read._tag).toBe("Loaded");
    if (read._tag === "Loaded") {
      expect(read.document.tasks).toHaveLength(1);
      expect(read.document.tasks[0]?.title).toBe("Ship auth");
    }
  });

  it("reports undecodable contents rather than reporting them as empty", () => {
    const read = ProjectTaskStore.readProjectTaskDocument(UNREADABLE);
    expect(read._tag).toBe("Unreadable");
  });
});

it.layer(NodeServices.layer)("ProjectTaskStore persistence", (it) => {
  it.effect("loads tasks that are already on disk", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const filePath = yield* stateDirFile("project-tasks.json");
      yield* fs.writeFileString(filePath, storedDocument("Existing work"));

      const store = yield* openStore;
      const listed = yield* store.list(projectId);
      expect(listed).toHaveLength(1);
      expect(listed[0]?.title).toBe("Existing work");
    }).pipe(withStateDir("t3-project-tasks-load-")),
  );

  it.effect("quarantines an unreadable document instead of overwriting it", () =>
    Effect.gen(function* () {
      const config = yield* ServerConfig.ServerConfig;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const filePath = yield* stateDirFile("project-tasks.json");
      yield* fs.writeFileString(filePath, UNREADABLE);

      const store = yield* openStore;
      yield* store.create({ projectId, title: "Fresh task" });

      const entries = yield* fs.readDirectory(config.stateDir);
      const quarantined = entries.filter((entry) => entry.startsWith("project-tasks.unreadable-"));
      expect(quarantined).toHaveLength(1);

      // The original bytes survive untouched...
      const preserved = yield* fs.readFileString(
        path.join(config.stateDir, quarantined[0] as string),
      );
      expect(preserved).toBe(UNREADABLE);

      // ...and the canonical file holds only what was written after recovery.
      const rewritten = ProjectTaskStore.readProjectTaskDocument(
        yield* fs.readFileString(filePath),
      );
      expect(rewritten._tag).toBe("Loaded");
      if (rewritten._tag === "Loaded") {
        expect(rewritten.document.tasks).toHaveLength(1);
        expect(rewritten.document.tasks[0]?.title).toBe("Fresh task");
      }
    }).pipe(withStateDir("t3-project-tasks-quarantine-")),
  );

  it.effect("streams the current list and every change after it", () =>
    Effect.gen(function* () {
      const store = yield* openStore;
      yield* store.create({ projectId, title: "First" });

      // Two emissions: the list as it stands on subscribe, then the list after
      // the next write. Taking both proves a subscriber needs no separate read.
      const emissions = yield* store.changes(projectId).pipe(
        Stream.tap((tasks) =>
          tasks.length === 1 ? store.create({ projectId, title: "Second" }) : Effect.void,
        ),
        Stream.take(2),
        Stream.runCollect,
      );

      expect(emissions[0]?.map((task) => task.title)).toEqual(["First"]);
      expect(emissions[1]?.map((task) => task.title)).toEqual(["First", "Second"]);
    }).pipe(withStateDir("t3-project-tasks-changes-")),
  );
});
