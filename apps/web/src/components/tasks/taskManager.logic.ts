import type { ProjectTask, ProjectTaskStatus } from "@t3tools/contracts";

export const TASK_STATUS_ORDER: ReadonlyArray<ProjectTaskStatus> = [
  "open",
  "doing",
  "review",
  "blocked",
  "done",
];

export const TASK_STATUS_LABEL: Record<ProjectTaskStatus, string> = {
  open: "Open",
  doing: "Doing",
  review: "Review",
  blocked: "Blocked",
  done: "Done",
};

export interface TaskRow {
  readonly task: ProjectTask;
  readonly depth: number;
  readonly parentTitle: string | null;
}

export function buildTaskRows(tasks: ReadonlyArray<ProjectTask>): ReadonlyArray<TaskRow> {
  const byParent = new Map<string | null, ProjectTask[]>();
  for (const task of tasks) {
    const key = task.parentId;
    const group = byParent.get(key) ?? [];
    group.push(task);
    byParent.set(key, group);
  }
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const rows: TaskRow[] = [];
  const visit = (task: ProjectTask, depth: number) => {
    rows.push({
      task,
      depth,
      parentTitle: task.parentId === null ? null : (byId.get(task.parentId)?.title ?? null),
    });
    for (const child of byParent.get(task.id) ?? []) {
      visit(child, depth + 1);
    }
  };
  for (const root of byParent.get(null) ?? []) {
    visit(root, 0);
  }
  for (const task of tasks) {
    if (
      task.parentId !== null &&
      !byId.has(task.parentId) &&
      !rows.some((row) => row.task.id === task.id)
    ) {
      visit(task, 0);
    }
  }
  return rows;
}

export function groupTaskRowsByStatus(
  rows: ReadonlyArray<TaskRow>,
): ReadonlyArray<{ readonly status: ProjectTaskStatus; readonly rows: ReadonlyArray<TaskRow> }> {
  return TASK_STATUS_ORDER.map((status) => ({
    status,
    rows: rows.filter((row) => row.task.status === status),
  }));
}
