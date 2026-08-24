import { WS_METHODS } from "@t3tools/contracts";

import { createEnvironmentRpcCommand, createEnvironmentRpcQueryAtomFamily } from "./runtime.ts";
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
    create: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:project-tasks:create",
      tag: WS_METHODS.projectTasksCreate,
    }),
    update: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:project-tasks:update",
      tag: WS_METHODS.projectTasksUpdate,
    }),
  };
}
