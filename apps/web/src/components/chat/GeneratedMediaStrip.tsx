import type { ScopedThreadRef } from "@t3tools/contracts";
import type { GeneratedMediaItem } from "@t3tools/client-runtime/generated-media";
import { memo, useState } from "react";

import { useAssetUrlState } from "../../assets/assetUrls";
import { cn } from "~/lib/utils";

const TILE_CLASS_NAME =
  "h-auto w-full max-h-[16rem] rounded-lg border border-border/40 object-contain bg-muted/30";

const GeneratedMediaTile = memo(function GeneratedMediaTile(props: {
  readonly threadRef: ScopedThreadRef;
  readonly item: GeneratedMediaItem;
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

  if (props.item.kind === "video") {
    return (
      <video
        src={assetUrl.url}
        aria-label={props.item.alt}
        controls
        playsInline
        preload="metadata"
        className={TILE_CLASS_NAME}
        onError={() => setFailedUrl(assetUrl.url)}
      />
    );
  }

  return (
    <img
      src={assetUrl.url}
      alt={props.item.alt}
      loading="lazy"
      draggable={false}
      className={TILE_CLASS_NAME}
      onError={() => setFailedUrl(assetUrl.url)}
    />
  );
});

export const GeneratedMediaStrip = memo(function GeneratedMediaStrip(props: {
  readonly threadRef: ScopedThreadRef;
  readonly items: ReadonlyArray<GeneratedMediaItem>;
}) {
  if (props.items.length === 0) return null;

  return (
    <ul
      className={cn(
        "mt-2 grid max-w-[36rem] gap-2",
        props.items.length === 1 ? "grid-cols-1" : "grid-cols-2",
      )}
      aria-label="Generated media from this turn"
    >
      {props.items.map((item) => (
        <li key={item.path} className="min-w-0">
          <GeneratedMediaTile threadRef={props.threadRef} item={item} />
        </li>
      ))}
    </ul>
  );
});
