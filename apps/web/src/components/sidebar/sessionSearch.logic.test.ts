import { describe, expect, it } from "vite-plus/test";

import {
  groupSessionsByRecency,
  sessionActivityAt,
  sessionRecencyGroup,
  startOfLocalDay,
} from "./sessionSearch.logic";

describe("session search grouping", () => {
  const noon = new Date("2026-08-24T12:00:00").getTime();

  it("buckets today, yesterday, this week, and older", () => {
    const todayStart = startOfLocalDay(noon);
    expect(sessionRecencyGroup(new Date(todayStart + 60_000).toISOString(), noon)).toBe("today");
    expect(sessionRecencyGroup(new Date(todayStart - 60_000).toISOString(), noon)).toBe(
      "yesterday",
    );
    expect(
      sessionRecencyGroup(new Date(todayStart - 3 * 24 * 60 * 60 * 1000).toISOString(), noon),
    ).toBe("week");
    expect(
      sessionRecencyGroup(new Date(todayStart - 10 * 24 * 60 * 60 * 1000).toISOString(), noon),
    ).toBe("older");
  });

  it("groups newest first and drops empty buckets", () => {
    const groups = groupSessionsByRecency(
      [
        { id: "old", at: "2026-07-01T00:00:00.000Z" },
        { id: "new", at: new Date(noon).toISOString() },
      ],
      noon,
      (session) => session.at,
    );
    expect(
      groups.map((group) => [group.group, group.sessions.map((session) => session.id)]),
    ).toEqual([
      ["today", ["new"]],
      ["older", ["old"]],
    ]);
  });

  it("prefers the latest user message for activity", () => {
    expect(
      sessionActivityAt({
        latestUserMessageAt: "2026-08-24T10:00:00.000Z",
        updatedAt: "2026-08-24T09:00:00.000Z",
        archivedAt: "2026-08-24T11:00:00.000Z",
      }),
    ).toBe("2026-08-24T10:00:00.000Z");
  });
});
