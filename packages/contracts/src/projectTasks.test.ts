import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";

import { ProjectId, ProjectTaskId, ThreadId } from "./baseSchemas.ts";
import { ProjectTask, ProjectTaskStatus } from "./projectTasks.ts";

describe("ProjectTask", () => {
  it("round-trips a backlog item", () => {
    const encoded = Schema.encodeSync(ProjectTask)({
      id: ProjectTaskId.make("task-1"),
      projectId: ProjectId.make("project-1"),
      title: "Ship auth",
      notes: "Split login from sessions",
      status: "open",
      parentId: null,
      claimedThreadId: null,
      createdAt: "2026-08-24T12:00:00.000Z",
      updatedAt: "2026-08-24T12:00:00.000Z",
    });
    expect(Schema.decodeUnknownSync(ProjectTask)(encoded).status).toBe("open");
  });

  it("rejects unknown statuses", () => {
    expect(Schema.is(ProjectTaskStatus)("working")).toBe(false);
    expect(Schema.is(ProjectTaskStatus)("doing")).toBe(true);
  });

  it("accepts a claimed thread and a parent", () => {
    const task = Schema.decodeUnknownSync(ProjectTask)({
      id: "task-2",
      projectId: "project-1",
      title: "Session tokens",
      notes: "",
      status: "doing",
      parentId: "task-1",
      claimedThreadId: "thread-9",
      createdAt: "2026-08-24T12:00:00.000Z",
      updatedAt: "2026-08-24T12:01:00.000Z",
    });
    expect(task.parentId).toBe(ProjectTaskId.make("task-1"));
    expect(task.claimedThreadId).toBe(ThreadId.make("thread-9"));
  });
});
