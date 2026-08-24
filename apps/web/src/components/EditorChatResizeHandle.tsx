import { useCallback, useRef, type PointerEvent } from "react";

import { cn } from "../lib/utils";

export function EditorChatResizeHandle(props: {
  readonly width: number;
  readonly minWidth: number;
  readonly maxWidth: number;
  readonly onResize: (width: number) => void;
  readonly onResizeEnd?: () => void;
}) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const clampWidth = useCallback(
    (width: number) => Math.max(props.minWidth, Math.min(width, props.maxWidth)),
    [props.maxWidth, props.minWidth],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: props.width,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [props.width],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      const nextWidth = clampWidth(drag.startWidth + (drag.startX - event.clientX));
      props.onResize(nextWidth);
    },
    [clampWidth, props],
  );

  const endDrag = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      props.onResizeEnd?.();
    },
    [props],
  );

  return (
    <button
      type="button"
      aria-label="Resize chat panel"
      title="Drag to resize chat"
      className={cn(
        "absolute inset-y-0 left-0 z-20 hidden w-4 -translate-x-1/2 cursor-col-resize sm:flex",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:bg-transparent",
        "hover:after:bg-sidebar-border",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
}
