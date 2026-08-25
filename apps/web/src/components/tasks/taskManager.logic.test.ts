import { describe, expect, it } from "vite-plus/test";
import { ProjectId, ProjectTaskId } from "@t3tools/contracts";

import { buildTaskRows, groupTaskRowsByStatus } from "./taskManager.logic";

const projectId = ProjectId.make("project-1");

function task(
  id: string,
  title: string,
  status: "open" | "doing" | "blocked" | "done",
  parentId: string | null = null,
) {
  return {
    id: ProjectTaskId.make(id),
    projectId,
    title,
    notes: "",
    status,
    parentId: parentId === null ? null : ProjectTaskId.make(parentId),
    claimedThreadId: null,
    createdAt: "2026-08-24T12:00:00.000Z",
    updatedAt: "2026-08-24T12:00:00.000Z",
  };
}

describe("task manager grouping", () => {
  it("nests children under their parent and groups by status", () => {
    const rows = buildTaskRows([
      task("1", "Auth", "open"),
      task("2", "Tokens", "doing", "1"),
      task("3", "Docs", "done"),
    ]);
    expect(rows.map((row) => `${row.depth}:${row.task.title}`)).toEqual([
      "0:Auth",
      "1:Tokens",
      "0:Docs",
    ]);
    const grouped = groupTaskRowsByStatus(rows);
    const titlesIn = (status: string) =>
      grouped.find((group) => group.status === status)?.rows.map((row) => row.task.title) ?? [];
    expect(titlesIn("open")).toEqual(["Auth"]);
    expect(titlesIn("doing")).toEqual(["Tokens"]);
    expect(titlesIn("review")).toEqual([]);
    expect(titlesIn("done")).toEqual(["Docs"]);
  });

  it("keeps orphans whose parent is missing", () => {
    const rows = buildTaskRows([task("2", "Orphan", "blocked", "missing")]);
    expect(rows).toEqual([
      {
        task: expect.objectContaining({ title: "Orphan" }),
        depth: 0,
        parentTitle: null,
      },
    ]);
  });
});
