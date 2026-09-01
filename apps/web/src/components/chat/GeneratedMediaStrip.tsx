import type { ScopedThreadRef } from "@t3tools/contracts";
import type { GeneratedMediaItem } from "@t3tools/client-runtime/generated-media";
import { CopyIcon, DownloadIcon, EllipsisIcon, FolderOpenIcon, Maximize2Icon } from "lucide-react";
import { memo, useState } from "react";

import { useAssetUrlState } from "../../assets/assetUrls";
import { cn } from "~/lib/utils";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { toastManager } from "../ui/toast";
import { downloadAsset, GeneratedMediaLightbox } from "./GeneratedMediaLightbox";
import { mediaFileName } from "./generatedMediaLightbox.logic";
import { useRevealWorkspaceFile } from "./useRevealWorkspaceFile";

const TILE_CLASS_NAME =
  "h-auto w-full max-h-[16rem] rounded-lg border border-border/40 object-contain bg-muted/30";

const OVERLAY_BUTTON_CLASS =
  "inline-flex size-6 items-center justify-center rounded-md bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transition-none";

const GeneratedMediaTile = memo(function GeneratedMediaTile(props: {
  readonly threadRef: ScopedThreadRef;
  readonly item: GeneratedMediaItem;
  readonly revealLabel: string | null;
  readonly onReveal: (path: string) => void;
  readonly onExpand: () => void;
}) {
  const assetUrl = useAssetUrlState(props.threadRef.environmentId, {
    _tag: "workspace-file",
    threadId: props.threadRef.threadId,
    path: props.item.path,
  });
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (assetUrl._tag === "Failure" || (assetUrl._tag === "Success" && failedUrl === assetUrl.url)) {
    return null;
  }
  if (assetUrl._tag !== "Success") {
    return (
      <span
        role="status"
        aria-label={`Loading ${props.item.kind}`}
        className="block aspect-video w-full rounded-lg bg-muted/60"
      />
    );
  }

  const url = assetUrl.url;
  const fileName = mediaFileName(props.item.path);
  const copyPath = () => {
    void navigator.clipboard.writeText(props.item.path).then(
      () => toastManager.add({ type: "success", title: "Path copied" }),
      () => toastManager.add({ type: "error", title: "Could not copy path" }),
    );
  };

  return (
    <figure className="group/media relative m-0 min-w-0">
      {props.item.kind === "video" ? (
        <video
          src={url}
          aria-label={props.item.alt}
          controls
          playsInline
          preload="metadata"
          className={TILE_CLASS_NAME}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <button
          type="button"
          className="block w-full cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          onClick={props.onExpand}
          aria-label={`Open ${fileName} larger`}
        >
          <img
            src={url}
            alt={props.item.alt}
            loading="lazy"
            draggable={false}
            className={TILE_CLASS_NAME}
            onError={() => setFailedUrl(url)}
          />
        </button>
      )}

      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity duration-150 ease-out focus-within:opacity-100 group-hover/media:opacity-100 motion-reduce:transition-none">
        <button
          type="button"
          className={OVERLAY_BUTTON_CLASS}
          onClick={props.onExpand}
          aria-label={`Open ${fileName} larger`}
        >
          <Maximize2Icon className="size-3.5" />
        </button>
        <button
          type="button"
          className={OVERLAY_BUTTON_CLASS}
          onClick={() => downloadAsset(url, fileName)}
          aria-label={`Download ${fileName}`}
        >
          <DownloadIcon className="size-3.5" />
        </button>
        <Menu>
          <MenuTrigger
            render={
              <button
                type="button"
                className={OVERLAY_BUTTON_CLASS}
                aria-label={`More actions for ${fileName}`}
              />
            }
          >
            <EllipsisIcon className="size-3.5" />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={props.onExpand}>
              <Maximize2Icon className="size-3.5" />
              Open larger
            </MenuItem>
            <MenuItem onClick={() => downloadAsset(url, fileName)}>
              <DownloadIcon className="size-3.5" />
              Download
            </MenuItem>
            {props.revealLabel ? (
              <MenuItem onClick={() => props.onReveal(props.item.path)}>
                <FolderOpenIcon className="size-3.5" />
                {props.revealLabel}
              </MenuItem>
            ) : null}
            <MenuItem onClick={copyPath}>
              <CopyIcon className="size-3.5" />
              Copy path
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>

      <figcaption className="mt-1 truncate px-0.5 text-[11px] text-muted-foreground">
        {fileName}
      </figcaption>
    </figure>
  );
});

export const GeneratedMediaStrip = memo(function GeneratedMediaStrip(props: {
  readonly threadRef: ScopedThreadRef;
  readonly items: ReadonlyArray<GeneratedMediaItem>;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const { label: revealLabel, reveal } = useRevealWorkspaceFile(props.threadRef.environmentId);

  if (props.items.length === 0) return null;

  return (
    <>
      <ul
        className={cn(
          "mt-2 grid max-w-[36rem] gap-2",
          props.items.length === 1 ? "grid-cols-1" : "grid-cols-2",
        )}
        aria-label="Generated media from this turn"
      >
        {props.items.map((item, index) => (
          <li key={item.path} className="min-w-0">
            <GeneratedMediaTile
              threadRef={props.threadRef}
              item={item}
              revealLabel={revealLabel}
              onReveal={reveal}
              onExpand={() => setExpandedIndex(index)}
            />
          </li>
        ))}
      </ul>
      {expandedIndex === null ? null : (
        <GeneratedMediaLightbox
          threadRef={props.threadRef}
          items={props.items}
          index={expandedIndex}
          onIndexChange={setExpandedIndex}
          onClose={() => setExpandedIndex(null)}
        />
      )}
    </>
  );
});
