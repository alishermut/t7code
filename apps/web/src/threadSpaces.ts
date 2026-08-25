import type { ContextMenuItem } from "@t3tools/contracts";

export const GENERAL_SPACE_ID = "general";
export const GENERAL_SPACE_NAME = "General";

export interface ThreadSpace {
  readonly id: string;
  readonly name: string;
}

export interface ThreadSpacesState {
  readonly spacesByProjectKey: Record<string, ReadonlyArray<ThreadSpace>>;
  readonly threadSpaceByThreadKey: Record<string, string>;
  readonly spaceExpandedById: Record<string, boolean>;
  readonly openThreadTabKeys: ReadonlyArray<string>;
}

export const EMPTY_THREAD_SPACES_STATE: ThreadSpacesState = {
  spacesByProjectKey: {},
  threadSpaceByThreadKey: {},
  spaceExpandedById: {},
  openThreadTabKeys: [],
};

export function createThreadSpaceId(): string {
  return `space_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function spaceExpansionKey(projectKey: string, spaceId: string): string {
  return `${projectKey}:${spaceId}`;
}

export function resolveThreadSpaceId(
  threadKey: string,
  assignments: Readonly<Record<string, string>>,
): string {
  const assigned = assignments[threadKey]?.trim();
  return assigned && assigned.length > 0 ? assigned : GENERAL_SPACE_ID;
}

export function isAssignedToCustomSpace(
  threadKey: string | null,
  assignments: Readonly<Record<string, string>>,
): boolean {
  if (threadKey === null) return false;
  return resolveThreadSpaceId(threadKey, assignments) !== GENERAL_SPACE_ID;
}

export function listSpacesForProject(
  spaces: ReadonlyArray<ThreadSpace> | undefined,
): ReadonlyArray<ThreadSpace> {
  const custom = (spaces ?? []).filter(
    (space) => space.id !== GENERAL_SPACE_ID && space.name.trim().length > 0,
  );
  return [{ id: GENERAL_SPACE_ID, name: GENERAL_SPACE_NAME }, ...custom];
}

export function isSpaceExpanded(
  expandedById: Readonly<Record<string, boolean>>,
  projectKey: string,
  spaceId: string,
): boolean {
  return expandedById[spaceExpansionKey(projectKey, spaceId)] ?? true;
}

export interface ThreadSpaceSection<T> {
  readonly key: string;
  readonly projectKey: string;
  readonly projectLabel: string | null;
  readonly spaceId: string;
  readonly spaceName: string;
  readonly threads: ReadonlyArray<T>;
}

export function buildThreadSpaceSections<T>(input: {
  readonly threads: ReadonlyArray<T>;
  readonly projectOrder: ReadonlyArray<{
    readonly projectKey: string;
    readonly projectLabel: string;
  }>;
  readonly projectKeyForThread: (thread: T) => string | null;
  readonly threadKeyForThread: (thread: T) => string;
  readonly spacesByProjectKey: Readonly<Record<string, ReadonlyArray<ThreadSpace>>>;
  readonly threadSpaceByThreadKey: Readonly<Record<string, string>>;
  readonly showProjectLabels: boolean;
}): ReadonlyArray<ThreadSpaceSection<T>> {
  const threadsByProject = new Map<string, T[]>();
  for (const thread of input.threads) {
    const projectKey = input.projectKeyForThread(thread);
    if (projectKey === null) continue;
    const list = threadsByProject.get(projectKey) ?? [];
    list.push(thread);
    threadsByProject.set(projectKey, list);
  }

  const sections: ThreadSpaceSection<T>[] = [];
  for (const project of input.projectOrder) {
    const projectThreads = threadsByProject.get(project.projectKey) ?? [];
    const spaces = listSpacesForProject(input.spacesByProjectKey[project.projectKey]);
    const hasCustomSpaces = spaces.length > 1;
    if (projectThreads.length === 0 && !hasCustomSpaces) {
      continue;
    }

    for (const space of spaces) {
      const spaceThreads = projectThreads.filter(
        (thread) =>
          resolveThreadSpaceId(input.threadKeyForThread(thread), input.threadSpaceByThreadKey) ===
          space.id,
      );
      if (space.id === GENERAL_SPACE_ID) {
        continue;
      }
      if (spaceThreads.length === 0) {
        continue;
      }
      sections.push({
        key: spaceExpansionKey(project.projectKey, space.id),
        projectKey: project.projectKey,
        projectLabel: input.showProjectLabels ? project.projectLabel : null,
        spaceId: space.id,
        spaceName: space.name,
        threads: spaceThreads,
      });
    }
  }

  return sections;
}

function normalizeSpaceName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 80);
}

export function createSpace(
  state: ThreadSpacesState,
  projectKey: string,
  name: string,
): { readonly state: ThreadSpacesState; readonly space: ThreadSpace | null } {
  const normalized = normalizeSpaceName(name);
  if (normalized === null || normalized.toLowerCase() === GENERAL_SPACE_NAME.toLowerCase()) {
    return { state, space: null };
  }
  const existing = state.spacesByProjectKey[projectKey] ?? [];
  if (existing.some((space) => space.name.toLowerCase() === normalized.toLowerCase())) {
    const already = existing.find((space) => space.name.toLowerCase() === normalized.toLowerCase());
    return { state, space: already ?? null };
  }
  const space: ThreadSpace = { id: createThreadSpaceId(), name: normalized };
  return {
    space,
    state: {
      ...state,
      spacesByProjectKey: {
        ...state.spacesByProjectKey,
        [projectKey]: [...existing, space],
      },
      spaceExpandedById: {
        ...state.spaceExpandedById,
        [spaceExpansionKey(projectKey, space.id)]: true,
      },
    },
  };
}

export function renameSpace(
  state: ThreadSpacesState,
  projectKey: string,
  spaceId: string,
  name: string,
): ThreadSpacesState {
  if (spaceId === GENERAL_SPACE_ID) return state;
  const normalized = normalizeSpaceName(name);
  if (normalized === null || normalized.toLowerCase() === GENERAL_SPACE_NAME.toLowerCase()) {
    return state;
  }
  const existing = state.spacesByProjectKey[projectKey] ?? [];
  const current = existing.find((space) => space.id === spaceId);
  if (current === undefined || current.name === normalized) {
    return state;
  }
  if (
    existing.some(
      (space) => space.id !== spaceId && space.name.toLowerCase() === normalized.toLowerCase(),
    )
  ) {
    return state;
  }
  return {
    ...state,
    spacesByProjectKey: {
      ...state.spacesByProjectKey,
      [projectKey]: existing.map((space) =>
        space.id === spaceId ? { id: space.id, name: normalized } : space,
      ),
    },
  };
}

export type SpaceActionMenuId = "new-session-in-space" | "rename-space" | "archive-space";

export function buildSpaceActionMenuItems(): ReadonlyArray<ContextMenuItem<SpaceActionMenuId>> {
  return [
    { id: "new-session-in-space", label: "New session in space", icon: "message-square-plus" },
    { id: "rename-space", label: "Rename", icon: "pencil" },
    { id: "archive-space", label: "Archive space", icon: "archive", separatorBefore: true },
  ];
}

export function deleteSpace(
  state: ThreadSpacesState,
  projectKey: string,
  spaceId: string,
): ThreadSpacesState {
  if (spaceId === GENERAL_SPACE_ID) return state;
  const existing = state.spacesByProjectKey[projectKey] ?? [];
  const nextSpaces = existing.filter((space) => space.id !== spaceId);
  if (nextSpaces.length === existing.length) return state;
  const nextAssignments = { ...state.threadSpaceByThreadKey };
  for (const [threadKey, assigned] of Object.entries(nextAssignments)) {
    if (assigned === spaceId) {
      delete nextAssignments[threadKey];
    }
  }
  const nextExpanded = { ...state.spaceExpandedById };
  delete nextExpanded[spaceExpansionKey(projectKey, spaceId)];
  const nextByProject = { ...state.spacesByProjectKey };
  if (nextSpaces.length === 0) {
    delete nextByProject[projectKey];
  } else {
    nextByProject[projectKey] = nextSpaces;
  }
  return {
    ...state,
    spacesByProjectKey: nextByProject,
    threadSpaceByThreadKey: nextAssignments,
    spaceExpandedById: nextExpanded,
  };
}

export function moveThreadToSpace(
  state: ThreadSpacesState,
  threadKey: string,
  spaceId: string,
): ThreadSpacesState {
  const nextId = spaceId === GENERAL_SPACE_ID ? undefined : spaceId;
  const current = state.threadSpaceByThreadKey[threadKey];
  if (current === nextId || (current === undefined && nextId === undefined)) {
    return state;
  }
  const nextAssignments = { ...state.threadSpaceByThreadKey };
  if (nextId === undefined) {
    delete nextAssignments[threadKey];
  } else {
    nextAssignments[threadKey] = nextId;
  }
  return {
    ...state,
    threadSpaceByThreadKey: nextAssignments,
  };
}

export function setSpaceExpanded(
  state: ThreadSpacesState,
  projectKey: string,
  spaceId: string,
  expanded: boolean,
): ThreadSpacesState {
  const key = spaceExpansionKey(projectKey, spaceId);
  if ((state.spaceExpandedById[key] ?? true) === expanded) {
    return state;
  }
  return {
    ...state,
    spaceExpandedById: {
      ...state.spaceExpandedById,
      [key]: expanded,
    },
  };
}

export function wrapThreadsIntoSpace(
  state: ThreadSpacesState,
  input: {
    readonly projectKey: string;
    readonly threadKeys: ReadonlyArray<string>;
    readonly name: string;
  },
): ThreadSpacesState {
  const threadKeys = [...new Set(input.threadKeys.filter((key) => key.length > 0))];
  if (threadKeys.length < 2) {
    return state;
  }

  const existingCustomId = threadKeys
    .map((key) => resolveThreadSpaceId(key, state.threadSpaceByThreadKey))
    .find((spaceId) => spaceId !== GENERAL_SPACE_ID);

  let next = state;
  let spaceId = existingCustomId;
  if (spaceId === undefined) {
    const created = createSpace(next, input.projectKey, input.name);
    if (created.space === null) {
      return next;
    }
    next = created.state;
    spaceId = created.space.id;
  }

  for (const threadKey of threadKeys) {
    next = moveThreadToSpace(next, threadKey, spaceId);
  }
  return setSpaceExpanded(next, input.projectKey, spaceId, true);
}

export function visibleThreadTabKeys(input: {
  readonly openThreadTabKeys: ReadonlyArray<string>;
  readonly activeThreadKey: string | null;
  readonly threadSpaceByThreadKey: Readonly<Record<string, string>>;
}): ReadonlyArray<string> {
  const activeThreadKey = input.activeThreadKey;
  if (activeThreadKey === null) {
    return [];
  }
  const spaceId = resolveThreadSpaceId(activeThreadKey, input.threadSpaceByThreadKey);
  if (spaceId === GENERAL_SPACE_ID) {
    return [activeThreadKey];
  }
  const keys = input.openThreadTabKeys.filter(
    (key) => resolveThreadSpaceId(key, input.threadSpaceByThreadKey) === spaceId,
  );
  if (keys.includes(activeThreadKey)) {
    return keys;
  }
  return [...keys, activeThreadKey];
}

export function openThreadTab(state: ThreadSpacesState, threadKey: string): ThreadSpacesState {
  if (state.openThreadTabKeys.includes(threadKey)) {
    return state;
  }
  return {
    ...state,
    openThreadTabKeys: [...state.openThreadTabKeys, threadKey],
  };
}

export function closeThreadTab(
  state: ThreadSpacesState,
  threadKey: string,
): { readonly state: ThreadSpacesState; readonly nextActiveKey: string | null } {
  const index = state.openThreadTabKeys.indexOf(threadKey);
  if (index < 0) {
    return { state, nextActiveKey: state.openThreadTabKeys.at(-1) ?? null };
  }
  const nextKeys = state.openThreadTabKeys.filter((key) => key !== threadKey);
  const neighbor = nextKeys[index] ?? nextKeys[index - 1] ?? null;
  return {
    state: {
      ...state,
      openThreadTabKeys: nextKeys,
    },
    nextActiveKey: neighbor,
  };
}
