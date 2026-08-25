import {
  ProjectId,
  ProjectTaskError,
  ProjectTaskId,
  type ProjectTask,
  type ProjectTaskCreateInput,
  type ProjectTaskStatus,
  type ProjectTaskUpdateInput,
  type ThreadId,
} from "@t3tools/contracts";

export interface ProjectTaskDocument {
  readonly version: 1;
  readonly tasks: ReadonlyArray<ProjectTask>;
}

export const EMPTY_PROJECT_TASK_DOCUMENT: ProjectTaskDocument = {
  version: 1,
  tasks: [],
};

/**
 * Titles are matched loosely so "Fix login redirect." and "fix  login redirect"
 * are the same backlog item. Deliberately not fuzzy beyond this: silently
 * folding two genuinely different tasks together is worse than one duplicate.
 */
function normalizeTitleForMatch(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
}

function findOpenDuplicate(
  document: ProjectTaskDocument,
  projectId: ProjectId,
  title: string,
  parentId: ProjectTaskId | null,
): ProjectTask | undefined {
  const needle = normalizeTitleForMatch(title);
  return document.tasks.find(
    (task) =>
      task.projectId === projectId &&
      task.status !== "done" &&
      task.parentId === parentId &&
      normalizeTitleForMatch(task.title) === needle,
  );
}

export function createProjectTask(
  document: ProjectTaskDocument,
  input: ProjectTaskCreateInput,
  now: string,
  id: ProjectTaskId,
): {
  readonly document: ProjectTaskDocument;
  readonly result: { readonly task: ProjectTask; readonly matchedExisting: boolean };
} {
  const parentId = input.parentId ?? null;
  if (parentId !== null && findTask(document, input.projectId, parentId) === undefined) {
    throw new ProjectTaskError({
      reason: "parent_missing",
      detail: `Parent task '${parentId}' was not found in this project.`,
    });
  }
  const duplicate = findOpenDuplicate(document, input.projectId, input.title, parentId);
  if (duplicate !== undefined) {
    return { document, result: { task: duplicate, matchedExisting: true } };
  }
  const task: ProjectTask = {
    id,
    projectId: input.projectId,
    title: input.title,
    notes: input.notes ?? "",
    status: input.status ?? "open",
    parentId,
    claimedThreadId: null,
    createdAt: now,
    updatedAt: now,
  };
  return {
    document: { version: 1, tasks: [...document.tasks, task] },
    result: { task, matchedExisting: false },
  };
}

export function updateProjectTask(
  document: ProjectTaskDocument,
  input: ProjectTaskUpdateInput,
  now: string,
): { readonly document: ProjectTaskDocument; readonly result: ProjectTask } {
  const current = findTask(document, input.projectId, input.id);
  if (current === undefined) {
    throw new ProjectTaskError({
      reason: "not_found",
      detail: `Task '${input.id}' was not found in this project.`,
    });
  }
  const parentId = input.parentId === undefined ? current.parentId : input.parentId;
  if (parentId === input.id) {
    throw new ProjectTaskError({
      reason: "cycle",
      detail: "A task cannot be its own parent.",
    });
  }
  if (parentId !== null && findTask(document, input.projectId, parentId) === undefined) {
    throw new ProjectTaskError({
      reason: "parent_missing",
      detail: `Parent task '${parentId}' was not found in this project.`,
    });
  }
  if (parentId !== null && wouldCycle(document, input.projectId, input.id, parentId)) {
    throw new ProjectTaskError({
      reason: "cycle",
      detail: "A task cannot be nested under one of its descendants.",
    });
  }
  const status: ProjectTaskStatus = input.status ?? current.status;
  const claimedThreadId =
    input.claimedThreadId !== undefined
      ? input.claimedThreadId
      : status === "open" || status === "done"
        ? null
        : current.claimedThreadId;
  const task: ProjectTask = {
    ...current,
    title: input.title ?? current.title,
    notes: input.notes ?? current.notes,
    status,
    parentId,
    claimedThreadId,
    updatedAt: now,
  };
  return {
    document: {
      version: 1,
      tasks: document.tasks.map((candidate) => (candidate.id === task.id ? task : candidate)),
    },
    result: task,
  };
}

export function deleteProjectTask(
  document: ProjectTaskDocument,
  projectId: ProjectId,
  id: ProjectTaskId,
  now: string,
): {
  readonly document: ProjectTaskDocument;
  readonly result: {
    readonly id: ProjectTaskId;
    readonly promotedChildIds: ReadonlyArray<ProjectTaskId>;
  };
} {
  if (findTask(document, projectId, id) === undefined) {
    throw new ProjectTaskError({
      reason: "not_found",
      detail: `Task '${id}' was not found in this project.`,
    });
  }
  const children = document.tasks.filter(
    (task) => task.projectId === projectId && task.parentId === id,
  );
  return {
    document: {
      version: 1,
      tasks: document.tasks
        .filter((task) => !(task.projectId === projectId && task.id === id))
        .map((task) =>
          task.projectId === projectId && task.parentId === id
            ? { ...task, parentId: null, updatedAt: now }
            : task,
        ),
    },
    result: { id, promotedChildIds: children.map((task) => task.id) },
  };
}

export function listProjectTasks(
  document: ProjectTaskDocument,
  projectId: ProjectId,
): ReadonlyArray<ProjectTask> {
  // Ties break on insertion order, not id. Agents file several tasks inside one
  // millisecond, and sorting those by a random UUID makes a live board reshuffle
  // rows for no reason the user can see.
  return document.tasks
    .map((task, index) => ({ task, index }))
    .filter((entry) => entry.task.projectId === projectId)
    .sort((left, right) => {
      if (left.task.createdAt !== right.task.createdAt) {
        return left.task.createdAt.localeCompare(right.task.createdAt);
      }
      return left.index - right.index;
    })
    .map((entry) => entry.task);
}

/**
 * Tasks a finished turn should advance to `review`.
 *
 * Only what this thread claimed and is still actively working. A task already
 * in `review`, `blocked`, or `done` has moved on for a reason, and a turn that
 * touched nothing has nothing to show a reviewer.
 */
export function selectTasksToReview(input: {
  readonly tasks: ReadonlyArray<ProjectTask>;
  readonly threadId: ThreadId;
  readonly landedChanges: boolean;
}): ReadonlyArray<ProjectTask> {
  if (!input.landedChanges) {
    return [];
  }
  return input.tasks.filter(
    (task) => task.claimedThreadId === input.threadId && task.status === "doing",
  );
}

export function claimProjectTask(
  document: ProjectTaskDocument,
  projectId: ProjectId,
  id: ProjectTaskId,
  threadId: ThreadId,
  now: string,
): { readonly document: ProjectTaskDocument; readonly result: ProjectTask } {
  return updateProjectTask(
    document,
    {
      projectId,
      id,
      status: "doing",
      claimedThreadId: threadId,
    },
    now,
  );
}

function findTask(
  document: ProjectTaskDocument,
  projectId: ProjectId,
  id: ProjectTaskId,
): ProjectTask | undefined {
  return document.tasks.find((task) => task.projectId === projectId && task.id === id);
}

function wouldCycle(
  document: ProjectTaskDocument,
  projectId: ProjectId,
  taskId: ProjectTaskId,
  nextParentId: ProjectTaskId,
): boolean {
  let cursor: ProjectTaskId | null = nextParentId;
  const seen = new Set<string>();
  while (cursor !== null) {
    if (cursor === taskId) {
      return true;
    }
    if (seen.has(cursor)) {
      return true;
    }
    seen.add(cursor);
    cursor = findTask(document, projectId, cursor)?.parentId ?? null;
  }
  return false;
}
