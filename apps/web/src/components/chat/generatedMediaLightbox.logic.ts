/**
 * Index arithmetic and naming for the expanded media view.
 *
 * Kept apart from the component because wrapping at both ends and splitting a
 * path the server may have written with either separator are the two places
 * this can quietly be wrong, and neither needs a DOM to check.
 */

/** Wraps at both ends, so the arrows never dead-end on a short strip. */
export function stepMediaIndex(current: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return (((current + delta) % total) + total) % total;
}

/**
 * File name for a download attribute and the expanded view's title.
 *
 * Paths arrive from whichever machine ran the agent, so a Windows environment
 * yields backslashes even when the browser is on macOS. Splitting on both
 * avoids saving a file literally named `C:\repo\out.png`.
 */
export function mediaFileName(path: string): string {
  const segments = path.replaceAll("\\", "/").split("/");
  return segments.findLast((segment) => segment.length > 0) ?? path;
}

/** "3 of 8", or null when there is nothing to page through. */
export function mediaPositionLabel(index: number, total: number): string | null {
  if (total <= 1) return null;
  return `${index + 1} of ${total}`;
}
