import { cn } from "~/lib/utils";

/**
 * Cycle and per-step delay move together: the front's spread is a fixed
 * fraction of the cycle, so changing only one would alter the shape of the
 * motion rather than just its speed.
 */
const CYCLE_MS = 900;
const STEP_MS = 125;

/** Cell position doubles as its React key: the grid never reorders. */
const CELLS = Array.from({ length: 9 }, (_unused, index) => {
  const row = Math.floor(index / 3);
  const column = index % 3;
  return { id: `${row}-${column}`, delayMs: (column + Math.abs(row - 1)) * STEP_MS };
});

/**
 * How lit the grid sits when it is not animating. `stopped` is the resting
 * state for a thread that wants something from you; `muted` is one that has
 * simply finished and is waiting to be read.
 */
const STILL_OPACITY = { stopped: 0.85, muted: 0.5 } as const;

export type PixelGridState = "running" | "stopped" | "muted";

/**
 * Nine dots on a 3x3 grid — the single indicator behind every session status.
 *
 * Motion answers "is anything happening": `running` drives a chevron wavefront
 * across the grid, the other two hold still. Colour answers "whose turn is it",
 * and arrives through `currentColor`, so the caller's status hue drives it and
 * this component never names a colour of its own.
 *
 * Sized to occupy the same 14-15px box as the `size-3.5` lucide icons it stands
 * in for, so moving between states never shifts a row.
 *
 * Cells carry their state on `data-pixel-grid-cell` so `prefers-reduced-motion`
 * can freeze the running grid from one rule in index.css without disturbing the
 * two that are already still.
 */
export function PixelGridLoader({
  state = "running",
  className,
}: {
  readonly state?: PixelGridState;
  readonly className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]", className)}
    >
      {CELLS.map(({ id, delayMs }) => (
        <span
          key={id}
          data-pixel-grid-cell={state}
          className="size-[4px] rounded-full bg-current"
          style={
            state === "running"
              ? { animation: `pixel-on ${CYCLE_MS}ms ease-in-out ${delayMs}ms infinite` }
              : { opacity: STILL_OPACITY[state] }
          }
        />
      ))}
    </span>
  );
}
