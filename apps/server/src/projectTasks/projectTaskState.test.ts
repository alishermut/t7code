import { describe, expect, it } from "vite-plus/test";
import { ProjectId, ProjectTaskError, ProjectTaskId, ThreadId } from "@t3tools/contracts";

import {
  claimProjectTask,
  createProjectTask,
  deleteProjectTask,
  EMPTY_PROJECT_TASK_DOCUMENT,
  listProjectTasks,
  selectTasksToReview,
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
      { projectId, title: "Session tokens", parentId: parent.result.task.id },
      now,
      ProjectTaskId.make("task-2"),
    );
    const claimed = claimProjectTask(
      child.document,
      projectId,
      child.result.task.id,
      ThreadId.make("thread-9"),
      "2026-08-24T12:05:00.000Z",
    );
    expect(claimed.result.status).toBe("doing");
    expect(claimed.result.claimedThreadId).toBe("thread-9");
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
      { projectId, title: "Child", parentId: parent.result.task.id },
      now,
      ProjectTaskId.make("task-2"),
    );
    expect(() =>
      updateProjectTask(
        child.document,
        { projectId, id: parent.result.task.id, parentId: child.result.task.id },
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
      created.result.task.id,
      ThreadId.make("thread-9"),
      now,
    );
    const done = updateProjectTask(
      claimed.document,
      { projectId, id: created.result.task.id, status: "done" },
      now,
    );
    expect(done.result.claimedThreadId).toBeNull();
  });

  it("returns the existing task instead of filing a near-duplicate", () => {
    const first = createProjectTask(
      EMPTY_PROJECT_TASK_DOCUMENT,
      { projectId, title: "Fix login redirect." },
      now,
      ProjectTaskId.make("task-1"),
    );
    const second = createProjectTask(
      first.document,
      { projectId, title: "fix  login   redirect" },
      now,
      ProjectTaskId.make("task-2"),
    );
    expect(second.result.matchedExisting).toBe(true);
    expect(second.result.task.id).toBe("task-1");
    expect(listProjectTasks(second.document, projectId)).toHaveLength(1);
  });

  it("files a new task when the matching one is already done", () => {
    const first = createProjectTask(
      EMPTY_PROJECT_TASK_DOCUMENT,
      { projectId, title: "Ship auth" },
      now,
      ProjectTaskId.make("task-1"),
    );
    const done = updateProjectTask(
      first.document,
      { projectId, id: first.result.task.id, status: "done" },
      now,
    );
    const second = createProjectTask(
      done.document,
      { projectId, title: "Ship auth" },
      now,
      ProjectTaskId.make("task-2"),
    );
    expect(second.result.matchedExisting).toBe(false);
    expect(listProjectTasks(second.document, projectId)).toHaveLength(2);
  });

  it("treats the same title under different parents as different tasks", () => {
    const parent = createProjectTask(
      EMPTY_PROJECT_TASK_DOCUMENT,
      { projectId, title: "Auth" },
      now,
      ProjectTaskId.make("task-1"),
    );
    const topLevel = createProjectTask(
      parent.document,
      { projectId, title: "Tests" },
      now,
      ProjectTaskId.make("task-2"),
    );
    const nested = createProjectTask(
      topLevel.document,
      { projectId, title: "Tests", parentId: parent.result.task.id },
      now,
      ProjectTaskId.make("task-3"),
    );
    expect(nested.result.matchedExisting).toBe(false);
    expect(listProjectTasks(nested.document, projectId)).toHaveLength(3);
  });

  it("keeps a claim through review and clears it on done", () => {
    const created = createProjectTask(
      EMPTY_PROJECT_TASK_DOCUMENT,
      { projectId, title: "Ship" },
      now,
      ProjectTaskId.make("task-1"),
    );
    const claimed = claimProjectTask(
      created.document,
      projectId,
      created.result.task.id,
      ThreadId.make("thread-9"),
      now,
    );
    const inReview = updateProjectTask(
      claimed.document,
      { projectId, id: created.result.task.id, status: "review" },
      now,
    );
    expect(inReview.result.status).toBe("review");
    expect(inReview.result.claimedThreadId).toBe("thread-9");

    const done = updateProjectTask(
      inReview.document,
      { projectId, id: created.result.task.id, status: "done" },
      now,
    );
    expect(done.result.claimedThreadId).toBeNull();
  });

  it("deletes a task and promotes its children to top level", () => {
    const parent = createProjectTask(
      EMPTY_PROJECT_TASK_DOCUMENT,
      { projectId, title: "Auth" },
      now,
      ProjectTaskId.make("task-1"),
    );
    const child = createProjectTask(
      parent.document,
      { projectId, title: "Session tokens", parentId: parent.result.task.id },
      now,
      ProjectTaskId.make("task-2"),
    );
    const deleted = deleteProjectTask(
      child.document,
      projectId,
      parent.result.task.id,
      "2026-08-24T12:10:00.000Z",
    );
    expect(deleted.result.promotedChildIds).toEqual(["task-2"]);
    const remaining = listProjectTasks(deleted.document, projectId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe("task-2");
    expect(remaining[0]?.parentId).toBeNull();
  });

  it("refuses to delete a task from another project", () => {
    const created = createProjectTask(
      EMPTY_PROJECT_TASK_DOCUMENT,
      { projectId, title: "Ship" },
      now,
      ProjectTaskId.make("task-1"),
    );
    expect(() =>
      deleteProjectTask(created.document, ProjectId.make("other"), created.result.task.id, now),
    ).toThrow(ProjectTaskError);
  });

  it("advances only the tasks this thread claimed and is still working", () => {
    const threadId = ThreadId.make("thread-9");
    const other = ThreadId.make("thread-other");
    const base = createProjectTask(
      EMPTY_PROJECT_TASK_DOCUMENT,
      { projectId, title: "Mine" },
      now,
      ProjectTaskId.make("task-1"),
    );
    const mine = claimProjectTask(
      base.document,
      projectId,
      ProjectTaskId.make("task-1"),
      threadId,
      now,
    );
    const withOther = createProjectTask(
      mine.document,
      { projectId, title: "Theirs" },
      now,
      ProjectTaskId.make("task-2"),
    );
    const theirs = claimProjectTask(
      withOther.document,
      projectId,
      ProjectTaskId.make("task-2"),
      other,
      now,
    );
    const withReviewed = createProjectTask(
      theirs.document,
      { projectId, title: "Already reviewed" },
      now,
      ProjectTaskId.make("task-3"),
    );
    const claimedThenReviewed = claimProjectTask(
      withReviewed.document,
      projectId,
      ProjectTaskId.make("task-3"),
      threadId,
      now,
    );
    const reviewed = updateProjectTask(
      claimedThenReviewed.document,
      { projectId, id: ProjectTaskId.make("task-3"), status: "review" },
      now,
    );

    const tasks = listProjectTasks(reviewed.document, projectId);
    const selected = selectTasksToReview({ tasks, threadId, landedChanges: true });
    expect(selected.map((task) => task.id)).toEqual(["task-1"]);
  });

  it("advances nothing when the turn changed no files", () => {
    const base = createProjectTask(
      EMPTY_PROJECT_TASK_DOCUMENT,
      { projectId, title: "Mine" },
      now,
      ProjectTaskId.make("task-1"),
    );
    const threadId = ThreadId.make("thread-9");
    const claimed = claimProjectTask(
      base.document,
      projectId,
      ProjectTaskId.make("task-1"),
      threadId,
      now,
    );
    const tasks = listProjectTasks(claimed.document, projectId);
    expect(selectTasksToReview({ tasks, threadId, landedChanges: false })).toEqual([]);
  });
});
