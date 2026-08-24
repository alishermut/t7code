import { createProjectTaskEnvironmentAtoms } from "@t3tools/client-runtime/state/projectTasks";

import { connectionAtomRuntime } from "../connection/runtime";

export const projectTaskEnvironment = createProjectTaskEnvironmentAtoms(connectionAtomRuntime);
