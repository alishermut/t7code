/**
 * The one place the backlog policy is written.
 *
 * Every provider gets this same text, injected into the turn the orchestration
 * layer builds rather than through any provider-native prompt slot. That is
 * what keeps Codex, Claude, Cursor, Grok, and OpenCode on identical behaviour
 * with no per-adapter code, and what stops a provider update from quietly
 * dropping the policy.
 *
 * The block is only ever attached when the `t3-code` MCP session is live:
 * describing tools the turn does not have is worse than saying nothing.
 *
 * @module TaskPolicyInstructions
 */
import type { ProjectTask } from "@t3tools/contracts";

/**
 * Unfinished tasks listed in the preamble. A backlog digest is a prompt tax on
 * every turn, so it stays small; the agent can always call `tasks_list` for the
 * rest.
 */
export const TASK_DIGEST_LIMIT = 12;

const POLICY_LINES = [
  "Before starting work the user asks for, check the backlog above.",
  "If the work is already listed, claim it with `tasks_claim` before you start.",
  "If it is not listed and it should outlive this session, file it with `tasks_create` and claim it.",
  "`tasks_create` returns an existing task when one already matches; take that task rather than rewording the title.",
  "T3 moves a claimed task to `review` on its own once your turn lands changes, so you do not need to.",
  "Only set `done` when the work is finished and confirmed.",
  "This is the project backlog, not this turn's private todo list. Do not confuse it with TodoWrite or plan steps.",
] as const;

/** Statuses worth spending prompt space on. Done work is not actionable. */
const isUnfinished = (task: ProjectTask): boolean => task.status !== "done";

const digestLine = (task: ProjectTask): string =>
  `- ${task.id} · ${task.status}${task.claimedThreadId === null ? "" : " · claimed"} · ${task.title}`;

/**
 * Render the block appended to a turn, or `null` when there is nothing useful
 * to say. Returning `null` rather than an empty string keeps the caller's
 * "did anything get added" check honest.
 */
export function composeTaskPolicyPreamble(input: {
  readonly tasks: ReadonlyArray<ProjectTask>;
  readonly limit?: number;
}): string | null {
  const limit = input.limit ?? TASK_DIGEST_LIMIT;
  const unfinished = input.tasks.filter(isUnfinished);
  const shown = unfinished.slice(0, limit);
  const hidden = unfinished.length - shown.length;

  const heading =
    shown.length === 0
      ? "[T3 Code project backlog — empty]"
      : `[T3 Code project backlog — ${unfinished.length} unfinished]`;

  const body =
    shown.length === 0
      ? ["(nothing filed yet)"]
      : [
          ...shown.map(digestLine),
          ...(hidden > 0 ? [`- …and ${hidden} more; call \`tasks_list\` for the full list.`] : []),
        ];

  return [heading, ...body, "", ...POLICY_LINES].join("\n");
}

/**
 * Attach the preamble to the turn text the provider will see.
 *
 * The backlog goes first: an agent reads the instruction "check the backlog
 * above" only after it has already seen the list.
 */
export function withTaskPolicyPreamble(input: {
  readonly text: string | undefined;
  readonly preamble: string | null;
}): string | undefined {
  if (input.preamble === null) {
    return input.text;
  }
  return input.text === undefined || input.text.length === 0
    ? input.preamble
    : `${input.preamble}\n\n${input.text}`;
}
