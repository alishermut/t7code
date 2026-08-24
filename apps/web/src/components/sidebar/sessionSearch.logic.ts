export type SessionLifecycle = "active" | "snoozed" | "done" | "archived";

export type SessionRecencyGroup = "today" | "yesterday" | "week" | "older";

export const SESSION_RECENCY_LABEL: Record<SessionRecencyGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Last 7 days",
  older: "Older",
};

export const SESSION_LIFECYCLE_LABEL: Record<SessionLifecycle, string> = {
  active: "Active",
  snoozed: "Snoozed",
  done: "Done",
  archived: "Archived",
};

export const SESSION_RECENCY_ORDER: ReadonlyArray<SessionRecencyGroup> = [
  "today",
  "yesterday",
  "week",
  "older",
];

export function startOfLocalDay(nowMs: number): number {
  const date = new Date(nowMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function sessionRecencyGroup(isoDate: string, nowMs: number): SessionRecencyGroup {
  const stamp = Date.parse(isoDate);
  if (Number.isNaN(stamp)) {
    return "older";
  }
  const today = startOfLocalDay(nowMs);
  const dayMs = 24 * 60 * 60 * 1000;
  if (stamp >= today) {
    return "today";
  }
  if (stamp >= today - dayMs) {
    return "yesterday";
  }
  if (stamp >= today - 7 * dayMs) {
    return "week";
  }
  return "older";
}

export function sessionActivityAt(input: {
  readonly latestUserMessageAt?: string | null;
  readonly updatedAt: string;
  readonly archivedAt?: string | null;
}): string {
  return input.latestUserMessageAt ?? input.archivedAt ?? input.updatedAt;
}

export function groupSessionsByRecency<T>(
  sessions: ReadonlyArray<T>,
  nowMs: number,
  activityAt: (session: T) => string,
): ReadonlyArray<{ readonly group: SessionRecencyGroup; readonly sessions: ReadonlyArray<T> }> {
  const buckets: Record<SessionRecencyGroup, T[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };
  const sorted = [...sessions].sort((left, right) =>
    activityAt(right).localeCompare(activityAt(left)),
  );
  for (const session of sorted) {
    buckets[sessionRecencyGroup(activityAt(session), nowMs)].push(session);
  }
  return SESSION_RECENCY_ORDER.filter((group) => buckets[group].length > 0).map((group) => ({
    group,
    sessions: buckets[group],
  }));
}
