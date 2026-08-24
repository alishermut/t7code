import { Debouncer } from "@tanstack/react-pacer";
import { create } from "zustand";
import { normalizeProjectPathForComparison } from "./lib/projectPaths";
import {
  closeThreadTab as closeThreadTabState,
  createSpace as createSpaceState,
  deleteSpace as deleteSpaceState,
  EMPTY_THREAD_SPACES_STATE,
  moveThreadToSpace as moveThreadToSpaceState,
  openThreadTab as openThreadTabState,
  renameSpace as renameSpaceState,
  setSpaceExpanded as setSpaceExpandedState,
  wrapThreadsIntoSpace as wrapThreadsIntoSpaceState,
  type ThreadSpace,
  type ThreadSpacesState,
} from "./threadSpaces";

export const PERSISTED_STATE_KEY = "t3code:ui-state:v1";
const THREAD_CHANGED_FILES_EXPANSION_VERSION = 1;
const LEGACY_PERSISTED_STATE_KEYS = [
  "t3code:renderer-state:v8",
  "t3code:renderer-state:v7",
  "t3code:renderer-state:v6",
  "t3code:renderer-state:v5",
  "t3code:renderer-state:v4",
  "t3code:renderer-state:v3",
  "codething:renderer-state:v4",
  "codething:renderer-state:v3",
  "codething:renderer-state:v2",
  "codething:renderer-state:v1",
] as const;

export interface PersistedUiState {
  projectExpandedById?: Record<string, boolean>;
  projectOrder?: string[];
  threadLastVisitedAtById?: Record<string, string>;
  collapsedProjectCwds?: string[];
  expandedProjectCwds?: string[];
  projectOrderCwds?: string[];
  defaultAdvertisedEndpointKey?: string | null;
  threadChangedFilesExpansionVersion?: typeof THREAD_CHANGED_FILES_EXPANSION_VERSION;
  threadChangedFilesExpandedById?: Record<string, Record<string, boolean>>;
  spacesByProjectKey?: Record<string, ReadonlyArray<ThreadSpace>>;
  threadSpaceByThreadKey?: Record<string, string>;
  spaceExpandedById?: Record<string, boolean>;
  openThreadTabKeys?: string[];
  workspaceMode?: "agent" | "editor" | "browser";
  workspaceLeftPane?: "chat" | "sessions";
  editorFileByProjectKey?: Record<string, string>;
}

export interface UiProjectState {
  projectExpandedById: Record<string, boolean>;
  projectOrder: string[];
}

export interface UiThreadState {
  threadLastVisitedAtById: Record<string, string>;
  threadChangedFilesExpandedById: Record<string, Record<string, boolean>>;
}

export interface UiEndpointState {
  defaultAdvertisedEndpointKey: string | null;
}

export type WorkspaceMode = "agent" | "editor" | "browser";
export type WorkspaceLeftPane = "chat" | "sessions";

export interface UiWorkspaceModeState {
  workspaceMode: WorkspaceMode;
  workspaceLeftPane: WorkspaceLeftPane;
  editorFileByProjectKey: Record<string, string>;
}

export interface UiState
  extends UiProjectState, UiThreadState, UiEndpointState, ThreadSpacesState, UiWorkspaceModeState {}

const initialState: UiState = {
  projectExpandedById: {},
  projectOrder: [],
  threadLastVisitedAtById: {},
  threadChangedFilesExpandedById: {},
  defaultAdvertisedEndpointKey: null,
  workspaceMode: "agent",
  workspaceLeftPane: "chat",
  editorFileByProjectKey: {},
  ...EMPTY_THREAD_SPACES_STATE,
};

const LEGACY_PROJECT_CWD_PREFERENCE_PREFIX = "legacy-project-cwd:";
const LEGACY_PROJECT_EXPANSION_DEFAULT_KEY = "legacy-project-expansion-default";
let legacyKeysCleanedUp = false;

export function legacyProjectCwdPreferenceKey(cwd: string): string {
  return `${LEGACY_PROJECT_CWD_PREFERENCE_PREFIX}${normalizeProjectPathForComparison(cwd)}`;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0),
    ),
  ];
}

function sanitizeBooleanRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] => entry[0].length > 0 && typeof entry[1] === "boolean",
    ),
  );
}

function sanitizeStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        entry[0].length > 0 && typeof entry[1] === "string" && entry[1].length > 0,
    ),
  );
}

function sanitizeSpacesByProjectKey(value: unknown): Record<string, ReadonlyArray<ThreadSpace>> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const next: Record<string, ThreadSpace[]> = {};
  for (const [projectKey, spaces] of Object.entries(value)) {
    if (projectKey.length === 0 || !Array.isArray(spaces)) continue;
    const sanitized = spaces.flatMap((space) => {
      if (!space || typeof space !== "object") return [];
      const id = "id" in space && typeof space.id === "string" ? space.id.trim() : "";
      const name = "name" in space && typeof space.name === "string" ? space.name.trim() : "";
      if (id.length === 0 || name.length === 0) return [];
      return [{ id, name }];
    });
    if (sanitized.length > 0) {
      next[projectKey] = sanitized;
    }
  }
  return next;
}

function sanitizeTimestampRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        entry[0].length > 0 &&
        typeof entry[1] === "string" &&
        entry[1].length > 0 &&
        Number.isFinite(Date.parse(entry[1])),
    ),
  );
}

export function parsePersistedState(parsed: PersistedUiState): UiState {
  const projectExpandedById =
    parsed.projectExpandedById === undefined
      ? (() => {
          const migrated: Record<string, boolean> = {};
          const collapsedProjectCwds = sanitizeStringArray(parsed.collapsedProjectCwds);
          const expandedProjectCwds = sanitizeStringArray(parsed.expandedProjectCwds);
          for (const cwd of collapsedProjectCwds) {
            migrated[legacyProjectCwdPreferenceKey(cwd)] = false;
          }
          for (const cwd of expandedProjectCwds) {
            migrated[legacyProjectCwdPreferenceKey(cwd)] = true;
          }
          if (!Array.isArray(parsed.collapsedProjectCwds) && expandedProjectCwds.length > 0) {
            migrated[LEGACY_PROJECT_EXPANSION_DEFAULT_KEY] = false;
          }
          return migrated;
        })()
      : sanitizeBooleanRecord(parsed.projectExpandedById);
  const projectOrder =
    parsed.projectOrder === undefined
      ? sanitizeStringArray(parsed.projectOrderCwds).map(legacyProjectCwdPreferenceKey)
      : sanitizeStringArray(parsed.projectOrder);

  return {
    projectExpandedById,
    projectOrder,
    threadLastVisitedAtById: sanitizeTimestampRecord(parsed.threadLastVisitedAtById),
    threadChangedFilesExpandedById:
      parsed.threadChangedFilesExpansionVersion === THREAD_CHANGED_FILES_EXPANSION_VERSION
        ? sanitizePersistedThreadChangedFilesExpanded(parsed.threadChangedFilesExpandedById)
        : {},
    defaultAdvertisedEndpointKey:
      typeof parsed.defaultAdvertisedEndpointKey === "string" &&
      parsed.defaultAdvertisedEndpointKey.length > 0
        ? parsed.defaultAdvertisedEndpointKey
        : null,
    spacesByProjectKey: sanitizeSpacesByProjectKey(parsed.spacesByProjectKey),
    threadSpaceByThreadKey: sanitizeStringRecord(parsed.threadSpaceByThreadKey),
    spaceExpandedById: sanitizeBooleanRecord(parsed.spaceExpandedById),
    openThreadTabKeys: sanitizeStringArray(parsed.openThreadTabKeys),
    workspaceMode:
      parsed.workspaceMode === "editor" || parsed.workspaceMode === "browser"
        ? parsed.workspaceMode
        : "agent",
    workspaceLeftPane: parsed.workspaceLeftPane === "sessions" ? "sessions" : "chat",
    editorFileByProjectKey: sanitizeStringRecord(parsed.editorFileByProjectKey),
  };
}

function readPersistedState(): UiState {
  if (typeof window === "undefined") {
    return initialState;
  }
  try {
    const raw = window.localStorage.getItem(PERSISTED_STATE_KEY);
    if (!raw) {
      for (const legacyKey of LEGACY_PERSISTED_STATE_KEYS) {
        const legacyRaw = window.localStorage.getItem(legacyKey);
        if (!legacyRaw) {
          continue;
        }
        return parsePersistedState(JSON.parse(legacyRaw) as PersistedUiState);
      }
      return initialState;
    }
    return parsePersistedState(JSON.parse(raw) as PersistedUiState);
  } catch {
    return initialState;
  }
}

function sanitizePersistedThreadChangedFilesExpanded(
  value: PersistedUiState["threadChangedFilesExpandedById"],
): Record<string, Record<string, boolean>> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const nextState: Record<string, Record<string, boolean>> = {};
  for (const [threadId, turns] of Object.entries(value)) {
    if (!threadId || !turns || typeof turns !== "object") {
      continue;
    }

    const nextTurns: Record<string, boolean> = {};
    for (const [turnId, expanded] of Object.entries(turns)) {
      if (turnId && typeof expanded === "boolean") {
        nextTurns[turnId] = expanded;
      }
    }

    if (Object.keys(nextTurns).length > 0) {
      nextState[threadId] = nextTurns;
    }
  }

  return nextState;
}

export function persistState(state: UiState): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const projectExpandedById = Object.fromEntries(
      Object.entries(state.projectExpandedById).filter(
        ([key]) => key !== LEGACY_PROJECT_EXPANSION_DEFAULT_KEY,
      ),
    );
    window.localStorage.setItem(
      PERSISTED_STATE_KEY,
      JSON.stringify({
        projectExpandedById,
        projectOrder: state.projectOrder,
        threadLastVisitedAtById: state.threadLastVisitedAtById,
        defaultAdvertisedEndpointKey: state.defaultAdvertisedEndpointKey,
        threadChangedFilesExpansionVersion: THREAD_CHANGED_FILES_EXPANSION_VERSION,
        threadChangedFilesExpandedById: state.threadChangedFilesExpandedById,
        spacesByProjectKey: state.spacesByProjectKey,
        threadSpaceByThreadKey: state.threadSpaceByThreadKey,
        spaceExpandedById: state.spaceExpandedById,
        openThreadTabKeys: [...state.openThreadTabKeys],
        workspaceMode: state.workspaceMode,
        workspaceLeftPane: state.workspaceLeftPane,
        editorFileByProjectKey: state.editorFileByProjectKey,
      } satisfies PersistedUiState),
    );
    if (!legacyKeysCleanedUp) {
      legacyKeysCleanedUp = true;
      for (const legacyKey of LEGACY_PERSISTED_STATE_KEYS) {
        window.localStorage.removeItem(legacyKey);
      }
    }
  } catch {
    // Ignore quota/storage errors to avoid breaking chat UX.
  }
}

const debouncedPersistState = new Debouncer(persistState, { wait: 500 });

export function markThreadVisited(state: UiState, threadId: string, visitedAt: string): UiState {
  const visitedAtMs = Date.parse(visitedAt);
  if (!Number.isFinite(visitedAtMs)) {
    return state;
  }
  const previousVisitedAt = state.threadLastVisitedAtById[threadId];
  const previousVisitedAtMs = previousVisitedAt ? Date.parse(previousVisitedAt) : NaN;
  if (
    Number.isFinite(previousVisitedAtMs) &&
    Number.isFinite(visitedAtMs) &&
    previousVisitedAtMs >= visitedAtMs
  ) {
    return state;
  }
  return {
    ...state,
    threadLastVisitedAtById: {
      ...state.threadLastVisitedAtById,
      [threadId]: visitedAt,
    },
  };
}

export function markThreadUnread(
  state: UiState,
  threadId: string,
  latestTurnCompletedAt: string | null | undefined,
): UiState {
  if (!latestTurnCompletedAt) {
    return state;
  }
  const latestTurnCompletedAtMs = Date.parse(latestTurnCompletedAt);
  if (Number.isNaN(latestTurnCompletedAtMs)) {
    return state;
  }
  const unreadVisitedAt = new Date(latestTurnCompletedAtMs - 1).toISOString();
  if (state.threadLastVisitedAtById[threadId] === unreadVisitedAt) {
    return state;
  }
  return {
    ...state,
    threadLastVisitedAtById: {
      ...state.threadLastVisitedAtById,
      [threadId]: unreadVisitedAt,
    },
  };
}

export function setThreadChangedFilesExpanded(
  state: UiState,
  threadId: string,
  turnId: string,
  expanded: boolean,
): UiState {
  const currentThreadState = state.threadChangedFilesExpandedById[threadId] ?? {};
  if (currentThreadState[turnId] === expanded) {
    return state;
  }

  return {
    ...state,
    threadChangedFilesExpandedById: {
      ...state.threadChangedFilesExpandedById,
      [threadId]: {
        ...currentThreadState,
        [turnId]: expanded,
      },
    },
  };
}

export function createProjectSpace(
  state: UiState,
  projectKey: string,
  name: string,
): { readonly state: UiState; readonly space: ThreadSpace | null } {
  const result = createSpaceState(state, projectKey, name);
  return { state: { ...state, ...result.state }, space: result.space };
}

export function deleteProjectSpace(state: UiState, projectKey: string, spaceId: string): UiState {
  return { ...state, ...deleteSpaceState(state, projectKey, spaceId) };
}

export function renameProjectSpace(
  state: UiState,
  projectKey: string,
  spaceId: string,
  name: string,
): UiState {
  return { ...state, ...renameSpaceState(state, projectKey, spaceId, name) };
}

export function assignThreadSpace(state: UiState, threadKey: string, spaceId: string): UiState {
  return { ...state, ...moveThreadToSpaceState(state, threadKey, spaceId) };
}

export function setProjectSpaceExpanded(
  state: UiState,
  projectKey: string,
  spaceId: string,
  expanded: boolean,
): UiState {
  return { ...state, ...setSpaceExpandedState(state, projectKey, spaceId, expanded) };
}

export function addOpenThreadTab(state: UiState, threadKey: string): UiState {
  return { ...state, ...openThreadTabState(state, threadKey) };
}

export function wrapProjectThreadsIntoSpace(
  state: UiState,
  input: {
    readonly projectKey: string;
    readonly threadKeys: ReadonlyArray<string>;
    readonly name: string;
  },
): UiState {
  return { ...state, ...wrapThreadsIntoSpaceState(state, input) };
}

export function removeOpenThreadTab(
  state: UiState,
  threadKey: string,
): { readonly state: UiState; readonly nextActiveKey: string | null } {
  const result = closeThreadTabState(state, threadKey);
  return { state: { ...state, ...result.state }, nextActiveKey: result.nextActiveKey };
}

export function setWorkspaceMode(state: UiState, workspaceMode: WorkspaceMode): UiState {
  if (state.workspaceMode === workspaceMode) {
    return state;
  }
  return {
    ...state,
    workspaceMode,
    workspaceLeftPane: workspaceMode === "agent" ? "chat" : state.workspaceLeftPane,
  };
}

export function setWorkspaceLeftPane(
  state: UiState,
  workspaceLeftPane: WorkspaceLeftPane,
): UiState {
  if (state.workspaceLeftPane === workspaceLeftPane) {
    return state;
  }
  return { ...state, workspaceLeftPane };
}

export function setEditorFileForProject(
  state: UiState,
  projectKey: string,
  relativePath: string | null,
): UiState {
  if (projectKey.length === 0) {
    return state;
  }
  const current = state.editorFileByProjectKey[projectKey] ?? null;
  if (relativePath === current || (relativePath === null && current === null)) {
    return state;
  }
  const editorFileByProjectKey = { ...state.editorFileByProjectKey };
  if (relativePath === null || relativePath.length === 0) {
    delete editorFileByProjectKey[projectKey];
  } else {
    editorFileByProjectKey[projectKey] = relativePath;
  }
  return { ...state, editorFileByProjectKey };
}

export function setDefaultAdvertisedEndpointKey(state: UiState, key: string | null): UiState {
  const nextKey = key && key.length > 0 ? key : null;
  if (state.defaultAdvertisedEndpointKey === nextKey) {
    return state;
  }
  return {
    ...state,
    defaultAdvertisedEndpointKey: nextKey,
  };
}

export function resolveProjectExpanded(
  projectExpandedById: Readonly<Record<string, boolean>>,
  preferenceKeys: readonly string[],
): boolean {
  for (const key of preferenceKeys) {
    const expanded = projectExpandedById[key];
    if (expanded !== undefined) {
      return expanded;
    }
  }
  return projectExpandedById[LEGACY_PROJECT_EXPANSION_DEFAULT_KEY] ?? true;
}

export function setProjectExpanded(
  state: UiState,
  projectIds: string | readonly string[],
  expanded: boolean,
): UiState {
  const ids = typeof projectIds === "string" ? [projectIds] : projectIds;
  const nextEntries = ids.filter((projectId) => state.projectExpandedById[projectId] !== expanded);
  if (nextEntries.length === 0) {
    return state;
  }
  const projectExpandedById = { ...state.projectExpandedById };
  for (const projectId of nextEntries) {
    projectExpandedById[projectId] = expanded;
  }
  return {
    ...state,
    projectExpandedById,
  };
}

export function reorderProjects(
  state: UiState,
  currentProjectOrder: readonly string[],
  draggedProjectIds: readonly string[],
  targetProjectIds: readonly string[],
): UiState {
  if (draggedProjectIds.length === 0) {
    return state;
  }
  const draggedSet = new Set(draggedProjectIds);
  const targetSet = new Set(targetProjectIds);
  if (draggedProjectIds.every((id) => targetSet.has(id))) {
    return state;
  }

  const originalTargetIndex = currentProjectOrder.findIndex((id) => targetSet.has(id));
  if (originalTargetIndex < 0) {
    return state;
  }

  const projectOrder = [...currentProjectOrder];

  const removed: string[] = [];
  let draggedBeforeTarget = 0;
  for (let i = projectOrder.length - 1; i >= 0; i--) {
    if (draggedSet.has(projectOrder[i]!)) {
      removed.unshift(projectOrder.splice(i, 1)[0]!);
      if (i < originalTargetIndex) {
        draggedBeforeTarget++;
      }
    }
  }
  if (removed.length === 0) {
    return state;
  }

  const insertIndex = originalTargetIndex - Math.max(0, draggedBeforeTarget - 1);
  projectOrder.splice(insertIndex, 0, ...removed);
  return {
    ...state,
    projectOrder,
  };
}

interface UiStateStore extends UiState {
  markThreadVisited: (threadId: string, visitedAt: string) => void;
  markThreadUnread: (threadId: string, latestTurnCompletedAt: string | null | undefined) => void;
  setThreadChangedFilesExpanded: (threadId: string, turnId: string, expanded: boolean) => void;
  setDefaultAdvertisedEndpointKey: (key: string | null) => void;
  setProjectExpanded: (projectIds: string | readonly string[], expanded: boolean) => void;
  reorderProjects: (
    currentProjectOrder: readonly string[],
    draggedProjectIds: readonly string[],
    targetProjectIds: readonly string[],
  ) => void;
  createProjectSpace: (projectKey: string, name: string) => ThreadSpace | null;
  deleteProjectSpace: (projectKey: string, spaceId: string) => void;
  renameProjectSpace: (projectKey: string, spaceId: string, name: string) => void;
  assignThreadSpace: (threadKey: string, spaceId: string) => void;
  setProjectSpaceExpanded: (projectKey: string, spaceId: string, expanded: boolean) => void;
  addOpenThreadTab: (threadKey: string) => void;
  wrapProjectThreadsIntoSpace: (input: {
    readonly projectKey: string;
    readonly threadKeys: ReadonlyArray<string>;
    readonly name: string;
  }) => void;
  removeOpenThreadTab: (threadKey: string) => string | null;
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void;
  setWorkspaceLeftPane: (workspaceLeftPane: WorkspaceLeftPane) => void;
  setEditorFileForProject: (projectKey: string, relativePath: string | null) => void;
}

export const useUiStateStore = create<UiStateStore>((set) => ({
  ...readPersistedState(),
  markThreadVisited: (threadId, visitedAt) =>
    set((state) => markThreadVisited(state, threadId, visitedAt)),
  markThreadUnread: (threadId, latestTurnCompletedAt) =>
    set((state) => markThreadUnread(state, threadId, latestTurnCompletedAt)),
  setThreadChangedFilesExpanded: (threadId, turnId, expanded) =>
    set((state) => setThreadChangedFilesExpanded(state, threadId, turnId, expanded)),
  setDefaultAdvertisedEndpointKey: (key) =>
    set((state) => setDefaultAdvertisedEndpointKey(state, key)),
  setProjectExpanded: (projectIds, expanded) =>
    set((state) => setProjectExpanded(state, projectIds, expanded)),
  reorderProjects: (currentProjectOrder, draggedProjectIds, targetProjectIds) =>
    set((state) =>
      reorderProjects(state, currentProjectOrder, draggedProjectIds, targetProjectIds),
    ),
  createProjectSpace: (projectKey, name) => {
    let space: ThreadSpace | null = null;
    set((state) => {
      const result = createProjectSpace(state, projectKey, name);
      space = result.space;
      return result.state;
    });
    return space;
  },
  deleteProjectSpace: (projectKey, spaceId) =>
    set((state) => deleteProjectSpace(state, projectKey, spaceId)),
  renameProjectSpace: (projectKey, spaceId, name) =>
    set((state) => renameProjectSpace(state, projectKey, spaceId, name)),
  assignThreadSpace: (threadKey, spaceId) =>
    set((state) => assignThreadSpace(state, threadKey, spaceId)),
  setProjectSpaceExpanded: (projectKey, spaceId, expanded) =>
    set((state) => setProjectSpaceExpanded(state, projectKey, spaceId, expanded)),
  addOpenThreadTab: (threadKey) => set((state) => addOpenThreadTab(state, threadKey)),
  wrapProjectThreadsIntoSpace: (input) => set((state) => wrapProjectThreadsIntoSpace(state, input)),
  removeOpenThreadTab: (threadKey) => {
    let nextActiveKey: string | null = null;
    set((state) => {
      const result = removeOpenThreadTab(state, threadKey);
      nextActiveKey = result.nextActiveKey;
      return result.state;
    });
    return nextActiveKey;
  },
  setWorkspaceMode: (workspaceMode) => set((state) => setWorkspaceMode(state, workspaceMode)),
  setWorkspaceLeftPane: (workspaceLeftPane) =>
    set((state) => setWorkspaceLeftPane(state, workspaceLeftPane)),
  setEditorFileForProject: (projectKey, relativePath) =>
    set((state) => setEditorFileForProject(state, projectKey, relativePath)),
}));

useUiStateStore.subscribe((state) => debouncedPersistState.maybeExecute(state));

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("beforeunload", () => {
    debouncedPersistState.flush();
  });
}
