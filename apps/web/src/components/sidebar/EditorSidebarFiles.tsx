import { scopeProjectRef } from "@t3tools/client-runtime/environment";

import FileBrowserPanel from "../files/FileBrowserPanel";
import { useHandleNewThread } from "../../hooks/useHandleNewThread";
import { useProjects } from "../../state/entities";
import { useUiStateStore } from "../../uiStateStore";

export function EditorSidebarFiles() {
  const projects = useProjects();
  const { activeThread, defaultProjectRef } = useHandleNewThread();
  const setEditorFileForProject = useUiStateStore((state) => state.setEditorFileForProject);
  const editorFileByProjectKey = useUiStateStore((state) => state.editorFileByProjectKey);
  const projectRef =
    activeThread !== null
      ? scopeProjectRef(activeThread.environmentId, activeThread.projectId)
      : defaultProjectRef;
  const project =
    projectRef === null
      ? null
      : (projects.find(
          (candidate) =>
            candidate.environmentId === projectRef.environmentId &&
            candidate.id === projectRef.projectId,
        ) ?? null);

  if (project === null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground">
        Add a project to browse files.
      </div>
    );
  }

  const projectKey = `${project.environmentId}:${project.id}`;
  const selectedPath = editorFileByProjectKey[projectKey] ?? null;
  const cwd = activeThread?.worktreePath ?? project.workspaceRoot;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <FileBrowserPanel
        environmentId={project.environmentId}
        cwd={cwd}
        projectName={project.title}
        selectedPath={selectedPath}
        selectedPathRevealId={0}
        onOpenFile={(relativePath) => setEditorFileForProject(projectKey, relativePath)}
      />
    </div>
  );
}
