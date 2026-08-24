import { createFileRoute } from "@tanstack/react-router";

import { TaskManagerPage } from "../components/tasks/TaskManagerPage";

export const Route = createFileRoute("/_chat/tasks")({
  component: TaskManagerPage,
});
