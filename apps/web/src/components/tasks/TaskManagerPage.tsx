import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  ProjectId,
  type ProjectTask,
  type ProjectTaskStatus,
  type ThreadId,
} from "@t3tools/contracts";
import { PlusIcon } from "lucide-react";
import { useMemo, useState, type DragEvent, type MouseEvent } from "react";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useNavigate } from "@tanstack/react-router";

import { isElectron } from "../../env";
import { cn } from "../../lib/utils";
import { useProjects, useThreadShells } from "../../state/entities";
import { projectTaskEnvironment } from "../../state/projectTasks";
import { useAtomCommand } from "../../state/use-atom-command";
import { useAtomQueryRunner } from "../../state/use-atom-query-runner";
import { buildThreadRouteParams } from "../../threadRoutes";
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SidebarInset } from "../ui/sidebar";
import {
  WorkspaceBreadcrumb,
  WorkspaceBreadcrumbItem,
  WorkspaceBreadcrumbSeparator,
} from "../WorkspaceBreadcrumb";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { TaskEditorDialog, type TaskEditorDraft } from "./TaskEditorDialog";
import { buildTaskRows, groupTaskRowsByStatus, TASK_STATUS_LABEL } from "./taskManager.logic";

const EMPTY_TASK_LIST_ATOM = Atom.make(
  AsyncResult.success({ tasks: [] as ReadonlyArray<ProjectTask> }),
).pipe(Atom.keepAlive, Atom.withLabel("web-project-tasks:empty"));

function projectKeyOf(project: { readonly environmentId: string; readonly id: string }): string {
  return `${project.environmentId}:${project.id}`;
}

function readListError(result: AsyncResult.AsyncResult<unknown, unknown>): string | null {
  if (result._tag !== "Failure") {
    return null;
  }
  const error = "error" in result ? result.error : undefined;
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return "The environment could not load this backlog.";
}

export function TaskManagerPage() {
  const projects = useProjects();
  const threads = useThreadShells();
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<ProjectTaskStatus | null>(null);
  const [editor, setEditor] = useState<
    | { readonly mode: "create"; readonly status: ProjectTaskStatus }
    | { readonly mode: "edit"; readonly task: ProjectTask }
    | null
  >(null);
  const selectedProject =
    projects.find((project) => projectKeyOf(project) === selectedKey) ?? projects[0] ?? null;
  const listTarget =
    selectedProject === null
      ? null
      : {
          environmentId: selectedProject.environmentId,
          input: { projectId: ProjectId.make(selectedProject.id) },
        };
  const listResult = useAtomValue(
    listTarget === null ? EMPTY_TASK_LIST_ATOM : projectTaskEnvironment.list(listTarget),
  );
  const listError = listTarget === null ? null : readListError(listResult);
  const listPending =
    listResult.waiting && !AsyncResult.isSuccess(listResult) && listError === null;
  const tasks = useMemo((): ReadonlyArray<ProjectTask> => {
    if (!AsyncResult.isSuccess(listResult)) {
      return [];
    }
    return Option.getOrElse(AsyncResult.value(listResult), () => ({ tasks: [] })).tasks;
  }, [listResult]);
  const grouped = useMemo(() => groupTaskRowsByStatus(buildTaskRows(tasks)), [tasks]);
  const threadTitleById = useMemo(
    () => new Map(threads.map((thread) => [thread.id, thread.title])),
    [threads],
  );
  const createTask = useAtomCommand(projectTaskEnvironment.create, "Create task");
  const updateTask = useAtomCommand(projectTaskEnvironment.update, "Update task");
  const reloadList = useAtomQueryRunner(projectTaskEnvironment.list, "Reload tasks");

  const refresh = async () => {
    if (listTarget !== null) {
      await reloadList(listTarget);
    }
  };

  const saveEditor = async (draft: TaskEditorDraft) => {
    if (selectedProject === null || editor === null) {
      return;
    }
    if (editor.mode === "create") {
      await createTask({
        environmentId: selectedProject.environmentId,
        input: {
          projectId: ProjectId.make(selectedProject.id),
          title: draft.title,
          notes: draft.notes,
          status: editor.status,
        },
      });
    } else {
      await updateTask({
        environmentId: selectedProject.environmentId,
        input: {
          projectId: editor.task.projectId,
          id: editor.task.id,
          title: draft.title,
          notes: draft.notes,
        },
      });
    }
    await refresh();
  };

  const setStatus = async (task: ProjectTask, status: ProjectTaskStatus) => {
    if (selectedProject === null || task.status === status) {
      return;
    }
    await updateTask({
      environmentId: selectedProject.environmentId,
      input: { projectId: task.projectId, id: task.id, status },
    });
    await refresh();
  };

  const openLinkedSession = (event: MouseEvent, threadId: ThreadId) => {
    event.stopPropagation();
    if (selectedProject === null) {
      return;
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(selectedProject.environmentId, threadId)),
    });
  };

  const onColumnDragOver = (status: ProjectTaskStatus, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropStatus(status);
  };

  const onColumnDrop = (status: ProjectTaskStatus, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDropStatus(null);
    const id = event.dataTransfer.getData("text/plain");
    const task = tasks.find((candidate) => candidate.id === id);
    if (task) {
      void setStatus(task, status);
    }
  };

  return (
    <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
      <WorkspacePageHeader electron={isElectron}>
        <WorkspaceBreadcrumb ariaLabel="Tasks">
          <WorkspaceBreadcrumbItem current={!selectedProject}>Tasks</WorkspaceBreadcrumbItem>
          {selectedProject ? (
            <>
              <WorkspaceBreadcrumbSeparator />
              <WorkspaceBreadcrumbItem current>{selectedProject.title}</WorkspaceBreadcrumbItem>
            </>
          ) : null}
        </WorkspaceBreadcrumb>
      </WorkspacePageHeader>
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-4 px-5 pt-5 pb-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="grid min-w-56 gap-1 text-sm">
            <span className="text-muted-foreground">Project</span>
            <Select
              value={selectedProject ? projectKeyOf(selectedProject) : null}
              onValueChange={(value) => {
                if (value) {
                  setSelectedKey(value);
                }
              }}
              items={projects.map((project) => ({
                value: projectKeyOf(project),
                label: project.title,
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectPopup>
                {projects.map((project) => (
                  <SelectItem key={projectKeyOf(project)} value={projectKeyOf(project)}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </label>
          {selectedProject ? (
            <Button type="button" onClick={() => setEditor({ mode: "create", status: "open" })}>
              <PlusIcon className="size-4" />
              New task
            </Button>
          ) : null}
        </div>

        {selectedProject === null ? (
          <p className="text-sm text-muted-foreground">Add a project to start a backlog.</p>
        ) : (
          <>
            {listError ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm">
                <p className="text-muted-foreground">{listError}</p>
                <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
                  Retry
                </Button>
              </div>
            ) : null}

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {grouped.map((group) => (
                <section
                  key={group.status}
                  className={cn(
                    "flex min-h-56 flex-col rounded-xl border bg-muted/30",
                    dropStatus === group.status ? "border-foreground/30" : "border-border/70",
                  )}
                  onDragOver={(event) => onColumnDragOver(group.status, event)}
                  onDragLeave={() => {
                    if (dropStatus === group.status) {
                      setDropStatus(null);
                    }
                  }}
                  onDrop={(event) => onColumnDrop(group.status, event)}
                >
                  <h2 className="flex items-center gap-2 px-3 pt-3 pb-2 text-sm font-medium">
                    <span className="min-w-0 flex-1 truncate">
                      {TASK_STATUS_LABEL[group.status]}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{group.rows.length}</span>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Add ${TASK_STATUS_LABEL[group.status].toLowerCase()} task`}
                      onClick={() => setEditor({ mode: "create", status: group.status })}
                    >
                      <PlusIcon className="size-3.5" />
                    </Button>
                  </h2>
                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 pb-2">
                    {listPending && group.rows.length === 0 ? (
                      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                        Loading…
                      </p>
                    ) : group.rows.length === 0 ? (
                      <p className="px-1 py-6 text-center text-sm text-muted-foreground/80">
                        No {TASK_STATUS_LABEL[group.status].toLowerCase()} tasks
                      </p>
                    ) : (
                      group.rows.map(({ task, parentTitle }) => {
                        const sessionTitle =
                          task.claimedThreadId === null
                            ? null
                            : (threadTitleById.get(task.claimedThreadId) ?? "Linked session");
                        return (
                          <article
                            key={task.id}
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData("text/plain", task.id);
                              event.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={() => setEditor({ mode: "edit", task })}
                            className="cursor-pointer rounded-lg border border-border/70 bg-background px-3 py-2 text-left"
                          >
                            <div className="truncate text-sm font-medium">{task.title}</div>
                            {parentTitle ? (
                              <div className="truncate text-xs text-muted-foreground">
                                Part of {parentTitle}
                              </div>
                            ) : null}
                            {task.notes ? (
                              <div className="line-clamp-2 text-xs text-muted-foreground">
                                {task.notes}
                              </div>
                            ) : null}
                            {task.claimedThreadId && sessionTitle ? (
                              <button
                                type="button"
                                className="mt-1 truncate text-xs text-foreground underline-offset-4 hover:underline"
                                onClick={(event) => {
                                  if (task.claimedThreadId !== null) {
                                    openLinkedSession(event, task.claimedThreadId);
                                  }
                                }}
                              >
                                {sessionTitle}
                              </button>
                            ) : null}
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
      {editor ? (
        <TaskEditorDialog
          open
          mode={editor.mode}
          initial={
            editor.mode === "create"
              ? { title: "", notes: "", status: editor.status }
              : { title: editor.task.title, notes: editor.task.notes, status: editor.task.status }
          }
          onOpenChange={(open) => {
            if (!open) {
              setEditor(null);
            }
          }}
          onSubmit={saveEditor}
        />
      ) : null}
    </SidebarInset>
  );
}
