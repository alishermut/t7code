import type { GeneratedMediaItem } from "@t3tools/client-runtime/generated-media";
import type { ScopedThreadRef } from "@t3tools/contracts";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  FolderOpenIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect } from "react";

import { useAssetUrlState } from "../../assets/assetUrls";
import { cn } from "~/lib/utils";
import { Dialog, DialogPopup, DialogTitle } from "../ui/dialog";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { mediaFileName, mediaPositionLabel, stepMediaIndex } from "./generatedMediaLightbox.logic";
import { useRevealWorkspaceFile } from "./useRevealWorkspaceFile";

const BAR_BUTTON_CLASS =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 motion-reduce:transition-none";

/** Saves the asset through the same anchor trick the composer uses for attachments. */
export function downloadAsset(url: string, fileName: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
}

function BarButton(props: {
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly onClick: () => void;
  readonly iconOnly?: boolean;
}) {
  const button = (
    <button
      type="button"
      className={cn(BAR_BUTTON_CLASS, props.iconOnly && "w-8 justify-center px-0")}
      onClick={props.onClick}
      aria-label={props.iconOnly ? props.label : undefined}
    >
      {props.icon}
      {props.iconOnly ? null : props.label}
    </button>
  );
  if (!props.iconOnly) return button;
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipPopup>{props.label}</TooltipPopup>
    </Tooltip>
  );
}

/**
 * Expanded view for one generated image or video.
 *
 * Paging is scoped to the message the media came from, so the arrows walk the
 * variants an agent produced in one turn rather than wandering the whole
 * thread. The stage keeps a neutral dark backing regardless of theme because a
 * transparent PNG on a light dialog reads as broken.
 */
export function GeneratedMediaLightbox(props: {
  readonly threadRef: ScopedThreadRef;
  readonly items: ReadonlyArray<GeneratedMediaItem>;
  readonly index: number;
  readonly onIndexChange: (index: number) => void;
  readonly onClose: () => void;
}) {
  const { items, index, onIndexChange, onClose } = props;
  const item = items[index];
  const assetUrl = useAssetUrlState(props.threadRef.environmentId, {
    _tag: "workspace-file",
    threadId: props.threadRef.threadId,
    path: item?.path ?? "",
  });
  const { label: revealLabel, reveal } = useRevealWorkspaceFile(props.threadRef.environmentId);

  const step = useCallback(
    (delta: number) => onIndexChange(stepMediaIndex(index, delta, items.length)),
    [index, items.length, onIndexChange],
  );

  useEffect(() => {
    if (items.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items.length, step]);

  if (!item) return null;

  const fileName = mediaFileName(item.path);
  const position = mediaPositionLabel(index, items.length);
  const url = assetUrl._tag === "Success" ? assetUrl.url : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup
        showCloseButton={false}
        bottomStickOnMobile={false}
        className="max-h-[92vh] w-full max-w-[min(92vw,72rem)] gap-0 p-0"
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-sm font-medium">{fileName}</DialogTitle>
            <p className="truncate text-xs text-muted-foreground">{item.path}</p>
          </div>
          {position ? (
            <span className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground">
              {position}
            </span>
          ) : null}
          {items.length > 1 ? (
            <>
              <BarButton
                iconOnly
                label="Previous"
                icon={<ChevronLeftIcon className="size-4" />}
                onClick={() => step(-1)}
              />
              <BarButton
                iconOnly
                label="Next"
                icon={<ChevronRightIcon className="size-4" />}
                onClick={() => step(1)}
              />
            </>
          ) : null}
          {url ? (
            <BarButton
              label="Download"
              icon={<DownloadIcon className="size-4" />}
              onClick={() => downloadAsset(url, fileName)}
            />
          ) : null}
          {revealLabel ? (
            <BarButton
              label={revealLabel}
              icon={<FolderOpenIcon className="size-4" />}
              onClick={() => reveal(item.path)}
            />
          ) : null}
          <BarButton
            iconOnly
            label="Copy path"
            icon={<CopyIcon className="size-4" />}
            onClick={() => {
              void navigator.clipboard.writeText(item.path).then(
                () => toastManager.add({ type: "success", title: "Path copied" }),
                () => toastManager.add({ type: "error", title: "Could not copy path" }),
              );
            }}
          />
          <BarButton iconOnly label="Close" icon={<XIcon className="size-4" />} onClick={onClose} />
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-neutral-950/40 p-3">
          {url === null ? (
            <span role="status" className="text-sm text-muted-foreground">
              Loading {item.kind}…
            </span>
          ) : item.kind === "video" ? (
            <video
              src={url}
              aria-label={item.alt}
              controls
              autoPlay
              playsInline
              className="max-h-[76vh] max-w-full rounded-md object-contain"
            />
          ) : (
            <img
              src={url}
              alt={item.alt}
              draggable={false}
              className="max-h-[76vh] max-w-full rounded-md object-contain"
            />
          )}
        </div>
      </DialogPopup>
    </Dialog>
  );
}
