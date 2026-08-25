/**
 * ProjectTaskReactor - Backlog transitions driven by turn outcomes.
 *
 * The half of backlog enforcement that does not depend on the model
 * cooperating: when a turn lands changes, the task that turn claimed advances
 * on its own. Works identically for every provider because it reads the
 * canonical runtime event stream rather than anything provider-shaped.
 *
 * @module ProjectTaskReactor
 */
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";

export interface ProjectTaskReactorShape {
  /**
   * Start reacting to provider runtime turn events.
   *
   * The returned effect must be run in a scope so worker fibers are finalized
   * on shutdown.
   */
  readonly start: () => Effect.Effect<void, never, Scope.Scope>;

  /**
   * Resolves when the internal processing queue is empty and idle. Lets tests
   * wait on a receipt instead of a sleep.
   */
  readonly drain: Effect.Effect<void>;
}

export class ProjectTaskReactor extends Context.Service<
  ProjectTaskReactor,
  ProjectTaskReactorShape
>()("t3/orchestration/Services/ProjectTaskReactor") {}
