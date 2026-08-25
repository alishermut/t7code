/**
 * ProjectTaskHealth - Evidence that providers can still reach the backlog.
 *
 * The failure this exists to catch is a provider update that stops surfacing
 * the `t3-code` MCP tools. Nothing in any adapter reports tool inventories back
 * to us, so the observable signal is the one the toolkit produces itself: a
 * `tasks_*` handler running for a given provider session.
 *
 * That makes this use-based, not capability-based. It tells you a provider
 * reached the backlog, and when — not that a provider which has never touched
 * it could. Read it that way.
 *
 * State is per-process and deliberately not persisted: a restart means nothing
 * has been proven yet, which is the honest answer.
 *
 * @module ProjectTaskHealth
 */
import type { ProjectTaskHealthEntry, ProviderInstanceId } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

/** The backlog tools, named so a typo cannot reach the health record. */
export type ProjectTaskToolName =
  | "tasks_list"
  | "tasks_create"
  | "tasks_update"
  | "tasks_delete"
  | "tasks_claim";

export interface ProjectTaskHealthShape {
  /** Record a successful backlog tool call for a provider session. */
  readonly recordToolUse: (input: {
    readonly providerInstanceId: ProviderInstanceId;
    readonly tool: ProjectTaskToolName;
  }) => Effect.Effect<void>;

  /** Every provider session that has reached the backlog this run. */
  readonly read: Effect.Effect<ReadonlyArray<ProjectTaskHealthEntry>>;
}

export class ProjectTaskHealth extends Context.Service<ProjectTaskHealth, ProjectTaskHealthShape>()(
  "t3/projectTasks/ProjectTaskHealth",
) {}

export const make = Effect.gen(function* () {
  const state = yield* Ref.make<ReadonlyMap<ProviderInstanceId, ProjectTaskHealthEntry>>(new Map());

  const recordToolUse: ProjectTaskHealthShape["recordToolUse"] = (input) =>
    Effect.gen(function* () {
      const lastToolAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
      yield* Ref.update(state, (current) => {
        const next = new Map(current);
        next.set(input.providerInstanceId, {
          providerInstanceId: input.providerInstanceId,
          lastTool: input.tool,
          lastToolAt,
        });
        return next;
      });
    });

  return {
    recordToolUse,
    read: Ref.get(state).pipe(Effect.map((current) => [...current.values()])),
  } satisfies ProjectTaskHealthShape;
});

export const layer = Layer.effect(ProjectTaskHealth, make);
