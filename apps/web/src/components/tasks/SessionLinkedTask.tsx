import { useAtomValue } from "@effect/atom-react";
import { ProjectId, type EnvironmentId, type ThreadId } from "@t3tools/contracts";
import { ListTodoIcon } from "lucide-react";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/unstable/reactivity";
import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";

import { projectTaskEnvironment } from "../../state/projectTasks";
import { Button } from "../ui/button";

export function SessionLinkedTask({
  environmentId,
  projectId,
  threadId,
}: {
  readonly environmentId: EnvironmentId;
  readonly projectId: string;
  readonly threadId: ThreadId;
}) {
  const navigate = useNavigate();
  const listResult = useAtomValue(
    projectTaskEnvironment.list({
      environmentId,
      input: { projectId: ProjectId.make(projectId) },
    }),
  );
  const linked = useMemo(() => {
    if (!AsyncResult.isSuccess(listResult)) {
      return [];
    }
    const tasks = Option.getOrElse(AsyncResult.value(listResult), () => ({ tasks: [] })).tasks;
    return tasks.filter((task) => task.claimedThreadId === threadId);
  }, [listResult, threadId]);

  if (linked.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 max-w-64 items-center gap-1">
      {linked.map((task) => (
        <Button
          key={task.id}
          type="button"
          size="xs"
          variant="outline"
          className="min-w-0 max-w-full"
          title={task.title}
          onClick={() => {
            void navigate({ to: "/tasks" });
          }}
        >
          <ListTodoIcon className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">{task.title}</span>
        </Button>
      ))}
    </div>
  );
}
