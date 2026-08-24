import { describe, expect, it } from "vite-plus/test";
import { ProjectId, ProjectTaskError, ProjectTaskId, ThreadId } from "@t3tools/contracts";

import {
  claimProjectTask,
  createProjectTask,
  EMPTY_PROJECT_TASK_DOCUMENT,
  listProjectTasks,
  updateProjectTask,
} from "./projectTaskState.ts";

const projectId = ProjectId.make("project-1");
const now = "2026-08-24T12:00:00.000Z";

describe("projectTaskState", () => {
  it("creates and lists tasks for one project", () => {
    const created = createProjectTask(
      EMPTY_PROJECT_TASK_DOCUMENT,
      { projectId, title: "Ship auth" },
      now,
      ProjectTaskId.make("task-1"),
    );
    expect(listProjectTasks(created.document, projectId)).toHaveLength(1);
    expect(listProjectTasks(created.document, ProjectId.make("other"))).toHaveLength(0);
  });

  it("nests a child under a parent and claims it onto a thread", () => {
    const parent = createProjectTask(
      EMPTY_PROJECT_TASK_DOCUMENT,
      { projectId, title: "Auth" },
      now,
      ProjectTaskId.make("task-1"),
    );
    const child = createProjectTask(
      parent.document,
      { projectId, title: "Session tokens", parentId: parent.task.id },
      now,
      ProjectTaskId.make("task-2"),
    );
    const claimed = claimProjectTask(
      child.document,
      projectId,
      child.task.id,
      ThreadId.make("thread-9"),
      "2026-08-24T12:05:00.000Z",
    );
    expect(claimed.task.status).toBe("doing");
    expect(claimed.task.claimedThreadId).toBe("thread-9");
  });

  it("rejects a missing parent and a cycle", () => {
    expect(() =>
      createProjectTask(
        EMPTY_PROJECT_TASK_DOCUMENT,
        { projectId, title: "Orphan child", parentId: ProjectTaskId.make("missing") },
        now,
        ProjectTaskId.make("task-1"),
      ),
    ).toThrow(ProjectTaskError);

    const parent = createProjectTask(
      EMPTY_PROJECT_TASK_DOCUMENT,
      { projectId, title: "Parent" },
      now,
      ProjectTaskId.make("task-1"),
    );
    const child = createProjectTask(
      parent.document,
      { projectId, title: "Child", parentId: parent.task.id },
      now,
      ProjectTaskId.make("task-2"),
    );
    expect(() =>
      updateProjectTask(
        child.document,
        { projectId, id: parent.task.id, parentId: child.task.id },
        now,
      ),
    ).toThrow(ProjectTaskError);
  });

  it("clears a claim when a task is marked done", () => {
    const created = createProjectTask(
      EMPTY_PROJECT_TASK_DOCUMENT,
      { projectId, title: "Ship" },
      now,
      ProjectTaskId.make("task-1"),
    );
    const claimed = claimProjectTask(
      created.document,
      projectId,
      created.task.id,
      ThreadId.make("thread-9"),
      now,
    );
    const done = updateProjectTask(
      claimed.document,
      { projectId, id: created.task.id, status: "done" },
      now,
    );
    expect(done.task.claimedThreadId).toBeNull();
  });
});
