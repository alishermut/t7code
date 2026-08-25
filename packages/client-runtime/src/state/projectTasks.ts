import { WS_METHODS } from "@t3tools/contracts";

import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "./runtime.ts";
import type { EnvironmentRegistry } from "../connection/registry.ts";
import type { Atom } from "effect/unstable/reactivity";

export function createProjectTaskEnvironmentAtoms<R, ER>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, ER>,
) {
  return {
    list: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:project-tasks:list",
      tag: WS_METHODS.projectTasksList,
      staleTimeMs: 0,
    }),
    /**
     * Live backlog. Agents write this list on their own once the turn policy is
     * injected, so anything showing it needs the push rather than a refetch
     * after its own mutation.
     */
    watch: createEnvironmentRpcSubscriptionAtomFamily(runtime, {
      label: "environment-data:project-tasks:watch",
      tag: WS_METHODS.subscribeProjectTasks,
    }),
    create: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:project-tasks:create",
      tag: WS_METHODS.projectTasksCreate,
    }),
    update: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:project-tasks:update",
      tag: WS_METHODS.projectTasksUpdate,
    }),
    remove: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:project-tasks:delete",
      tag: WS_METHODS.projectTasksDelete,
    }),
  };
}
