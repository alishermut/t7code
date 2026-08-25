import { describe, expect, it } from "vite-plus/test";
import { ProjectId, ProjectTaskId, ThreadId, type ProjectTask } from "@t3tools/contracts";

import { composeTaskPolicyPreamble, withTaskPolicyPreamble } from "./TaskPolicyInstructions.ts";

const projectId = ProjectId.make("project-1");

function task(id: string, title: string, status: ProjectTask["status"]): ProjectTask {
  return {
    id: ProjectTaskId.make(id),
    projectId,
    title,
    notes: "",
    status,
    parentId: null,
    claimedThreadId: null,
    createdAt: "2026-08-24T12:00:00.000Z",
    updatedAt: "2026-08-24T12:00:00.000Z",
  };
}

describe("composeTaskPolicyPreamble", () => {
  it("says so plainly when nothing is filed", () => {
    const preamble = composeTaskPolicyPreamble({ tasks: [] });
    expect(preamble).toContain("backlog — empty");
    expect(preamble).toContain("nothing filed yet");
    expect(preamble).toContain("tasks_claim");
  });

  it("lists unfinished work and leaves done work out", () => {
    const preamble = composeTaskPolicyPreamble({
      tasks: [task("t1", "Ship auth", "open"), task("t2", "Old thing", "done")],
    });
    expect(preamble).toContain("Ship auth");
    expect(preamble).not.toContain("Old thing");
    expect(preamble).toContain("1 unfinished");
  });

  it("marks a claimed task so the agent knows it is already taken", () => {
    const claimed: ProjectTask = {
      ...task("t1", "Ship auth", "doing"),
      claimedThreadId: ThreadId.make("thread-9"),
    };
    expect(composeTaskPolicyPreamble({ tasks: [claimed] })).toContain("claimed");
  });

  it("caps the digest and points at tasks_list for the rest", () => {
    const many = Array.from({ length: 5 }, (_unused, index) =>
      task(`t${index}`, `Task ${index}`, "open"),
    );
    const preamble = composeTaskPolicyPreamble({ tasks: many, limit: 2 });
    expect(preamble).toContain("Task 0");
    expect(preamble).not.toContain("Task 4");
    expect(preamble).toContain("and 3 more");
    expect(preamble).toContain("5 unfinished");
  });
});

describe("withTaskPolicyPreamble", () => {
  it("leaves the turn untouched when there is no preamble", () => {
    expect(withTaskPolicyPreamble({ text: "fix the bug", preamble: null })).toBe("fix the bug");
    expect(withTaskPolicyPreamble({ text: undefined, preamble: null })).toBeUndefined();
  });

  it("puts the backlog before the user's message", () => {
    const composed = withTaskPolicyPreamble({ text: "fix the bug", preamble: "BACKLOG" });
    expect(composed).toBe("BACKLOG\n\nfix the bug");
  });

  it("carries the preamble on an attachment-only turn", () => {
    expect(withTaskPolicyPreamble({ text: undefined, preamble: "BACKLOG" })).toBe("BACKLOG");
    expect(withTaskPolicyPreamble({ text: "", preamble: "BACKLOG" })).toBe("BACKLOG");
  });
});
