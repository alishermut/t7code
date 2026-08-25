import { expect, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { ProjectId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import * as ProjectTaskStore from "../../../projectTasks/ProjectTaskStore.ts";

const projectId = ProjectId.make("project-1");
const threadId = ThreadId.make("thread-1");

it.layer(NodeServices.layer)("project task store", (it) => {
  it.effect("stores a claimed backlog item in memory", () =>
    Effect.gen(function* () {
      const store = yield* ProjectTaskStore.ProjectTaskStore;
      const created = yield* store.create({ projectId, title: "Ship auth" });
      const claimed = yield* store.claim({ projectId, id: created.task.id, threadId });
      const listed = yield* store.list(projectId);
      expect(listed).toHaveLength(1);
      expect(claimed.status).toBe("doing");
      expect(claimed.claimedThreadId).toBe(threadId);
    }).pipe(Effect.provide(ProjectTaskStore.layerMemory)),
  );

  it.effect("nests a child under a parent", () =>
    Effect.gen(function* () {
      const store = yield* ProjectTaskStore.ProjectTaskStore;
      const parent = yield* store.create({ projectId, title: "Auth" });
      const child = yield* store.create({
        projectId,
        title: "Session tokens",
        parentId: parent.task.id,
      });
      expect(child.task.parentId).toBe(parent.task.id);
    }).pipe(Effect.provide(ProjectTaskStore.layerMemory)),
  );
});
