import { describe, expect, it } from "vite-plus/test";

import {
  buildSpaceActionMenuItems,
  buildThreadSpaceSections,
  closeThreadTab,
  createSpace,
  deleteSpace,
  EMPTY_THREAD_SPACES_STATE,
  GENERAL_SPACE_ID,
  GENERAL_SPACE_NAME,
  listSpacesForProject,
  moveThreadToSpace,
  openThreadTab,
  renameSpace,
  isAssignedToCustomSpace,
  resolveThreadSpaceId,
  visibleThreadTabKeys,
  wrapThreadsIntoSpace,
} from "./threadSpaces";

describe("thread spaces", () => {
  it("treats unassigned threads as General", () => {
    expect(resolveThreadSpaceId("env:thread-1", {})).toBe(GENERAL_SPACE_ID);
    expect(resolveThreadSpaceId("env:thread-1", { "env:thread-1": "space_a" })).toBe("space_a");
    expect(isAssignedToCustomSpace(null, {})).toBe(false);
    expect(isAssignedToCustomSpace("env:thread-1", {})).toBe(false);
    expect(isAssignedToCustomSpace("env:thread-1", { "env:thread-1": "space_a" })).toBe(true);
  });

  it("always lists General ahead of custom spaces", () => {
    expect(listSpacesForProject([{ id: "space_a", name: "Review" }])).toEqual([
      { id: GENERAL_SPACE_ID, name: GENERAL_SPACE_NAME },
      { id: "space_a", name: "Review" },
    ]);
  });

  it("creates a custom space and moves a thread into it", () => {
    const created = createSpace(EMPTY_THREAD_SPACES_STATE, "project-a", " Review ");
    expect(created.space?.name).toBe("Review");
    expect(created.space?.id).toBeTruthy();
    const moved = moveThreadToSpace(created.state, "env:thread-1", created.space!.id);
    expect(resolveThreadSpaceId("env:thread-1", moved.threadSpaceByThreadKey)).toBe(
      created.space!.id,
    );
  });

  it("returns threads to General when their space is deleted", () => {
    const created = createSpace(EMPTY_THREAD_SPACES_STATE, "project-a", "Review");
    const spaceId = created.space!.id;
    const assigned = moveThreadToSpace(created.state, "env:thread-1", spaceId);
    const deleted = deleteSpace(assigned, "project-a", spaceId);
    expect(deleted.spacesByProjectKey["project-a"]).toBeUndefined();
    expect(resolveThreadSpaceId("env:thread-1", deleted.threadSpaceByThreadKey)).toBe(
      GENERAL_SPACE_ID,
    );
  });

  it("groups active threads under project spaces", () => {
    const created = createSpace(EMPTY_THREAD_SPACES_STATE, "project-a", "Review");
    const spaceId = created.space!.id;
    const assigned = moveThreadToSpace(created.state, "t-review", spaceId);
    const sections = buildThreadSpaceSections({
      threads: ["t-general", "t-review"],
      projectOrder: [{ projectKey: "project-a", projectLabel: "Repo" }],
      projectKeyForThread: () => "project-a",
      threadKeyForThread: (thread) => thread,
      spacesByProjectKey: assigned.spacesByProjectKey,
      threadSpaceByThreadKey: assigned.threadSpaceByThreadKey,
      showProjectLabels: false,
    });
    expect(sections.map((section) => [section.spaceName, ...section.threads])).toEqual([
      ["Review", "t-review"],
    ]);
  });

  it("renames a custom space and ignores empty or colliding names", () => {
    const created = createSpace(EMPTY_THREAD_SPACES_STATE, "project-a", "Review");
    const spaceId = created.space!.id;
    const renamed = renameSpace(created.state, "project-a", spaceId, "  Ship  ");
    expect(renamed.spacesByProjectKey["project-a"]?.[0]?.name).toBe("Ship");
    expect(renameSpace(renamed, "project-a", spaceId, "   ")).toBe(renamed);
    const other = createSpace(renamed, "project-a", "Other");
    expect(renameSpace(other.state, "project-a", spaceId, "Other")).toBe(other.state);
  });

  it("offers new session, rename, and archive on the space menu without attach", () => {
    expect(buildSpaceActionMenuItems().map((item) => item.id)).toEqual([
      "new-session-in-space",
      "rename-space",
      "archive-space",
    ]);
  });

  it("wraps two tabs into a space named after the first thread", () => {
    const wrapped = wrapThreadsIntoSpace(EMPTY_THREAD_SPACES_STATE, {
      projectKey: "project-a",
      threadKeys: ["t-1", "t-2"],
      name: "check this repo",
    });
    const spaceId = wrapped.threadSpaceByThreadKey["t-1"];
    expect(spaceId).toBeTruthy();
    expect(wrapped.threadSpaceByThreadKey["t-2"]).toBe(spaceId);
    expect(wrapped.spacesByProjectKey["project-a"]?.[0]?.name).toBe("check this repo");
  });

  it("joins a third tab into the existing space instead of minting another", () => {
    const first = wrapThreadsIntoSpace(EMPTY_THREAD_SPACES_STATE, {
      projectKey: "project-a",
      threadKeys: ["t-1", "t-2"],
      name: "check this repo",
    });
    const spaceId = first.threadSpaceByThreadKey["t-1"];
    const joined = wrapThreadsIntoSpace(first, {
      projectKey: "project-a",
      threadKeys: ["t-2", "t-3"],
      name: "ignored",
    });
    expect(joined.threadSpaceByThreadKey["t-3"]).toBe(spaceId);
    expect(joined.spacesByProjectKey["project-a"]).toHaveLength(1);
  });

  it("shows only the active thread as a tab until it is grouped into a space", () => {
    expect(
      visibleThreadTabKeys({
        openThreadTabKeys: ["t-1", "t-2", "t-3"],
        activeThreadKey: "t-2",
        threadSpaceByThreadKey: {},
      }),
    ).toEqual(["t-2"]);
  });

  it("shows only tabs that share the active thread's space", () => {
    const wrapped = wrapThreadsIntoSpace(EMPTY_THREAD_SPACES_STATE, {
      projectKey: "project-a",
      threadKeys: ["t-1", "t-2"],
      name: "check this repo",
    });
    const opened = openThreadTab(openThreadTab(openThreadTab(wrapped, "t-1"), "t-2"), "t-lonely");
    expect(
      visibleThreadTabKeys({
        openThreadTabKeys: opened.openThreadTabKeys,
        activeThreadKey: "t-2",
        threadSpaceByThreadKey: opened.threadSpaceByThreadKey,
      }),
    ).toEqual(["t-1", "t-2"]);
    expect(
      visibleThreadTabKeys({
        openThreadTabKeys: opened.openThreadTabKeys,
        activeThreadKey: "t-lonely",
        threadSpaceByThreadKey: opened.threadSpaceByThreadKey,
      }),
    ).toEqual(["t-lonely"]);
  });

  it("opens and closes tabs, focusing a neighbor", () => {
    const opened = openThreadTab(openThreadTab(EMPTY_THREAD_SPACES_STATE, "t-1"), "t-2");
    expect(opened.openThreadTabKeys).toEqual(["t-1", "t-2"]);
    expect(closeThreadTab(opened, "t-1").nextActiveKey).toBe("t-2");
    expect(closeThreadTab(opened, "t-2").nextActiveKey).toBe("t-1");
  });
});
