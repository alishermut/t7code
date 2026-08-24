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

export function createProjectTask(
  document: ProjectTaskDocument,
  input: ProjectTaskCreateInput,
  now: string,
  id: ProjectTaskId,
): { readonly document: ProjectTaskDocument; readonly task: ProjectTask } {
  const parentId = input.parentId ?? null;
  if (parentId !== null && findTask(document, input.projectId, parentId) === undefined) {
    throw new ProjectTaskError({
      reason: "parent_missing",
      detail: `Parent task '${parentId}' was not found in this project.`,
    });
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
  return { document: { version: 1, tasks: [...document.tasks, task] }, task };
}

export function updateProjectTask(
  document: ProjectTaskDocument,
  input: ProjectTaskUpdateInput,
  now: string,
): { readonly document: ProjectTaskDocument; readonly task: ProjectTask } {
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
    task,
  };
}

export function listProjectTasks(
  document: ProjectTaskDocument,
  projectId: ProjectId,
): ReadonlyArray<ProjectTask> {
  return document.tasks
    .filter((task) => task.projectId === projectId)
    .slice()
    .sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return left.createdAt.localeCompare(right.createdAt);
      }
      return left.id.localeCompare(right.id);
    });
}

export function claimProjectTask(
  document: ProjectTaskDocument,
  projectId: ProjectId,
  id: ProjectTaskId,
  threadId: ThreadId,
  now: string,
): { readonly document: ProjectTaskDocument; readonly task: ProjectTask } {
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
