import { classifyMarkdownImageSource } from "./markdownImages.ts";
import {
  isWorkspaceGeneratedMediaPath,
  isWorkspaceVideoPreviewPath,
} from "@t3tools/shared/filePreview";

export type GeneratedMediaKind = "image" | "video";
export type GeneratedMediaSource = "markdown" | "checkpoint" | "tool";

export interface GeneratedMediaItem {
  readonly path: string;
  readonly kind: GeneratedMediaKind;
  readonly alt: string;
  readonly source: GeneratedMediaSource;
}

const MARKDOWN_MEDIA_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g;
const HTML_MEDIA_PATTERN = /<(?:img|video)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

function mediaKindForPath(path: string): GeneratedMediaKind {
  return isWorkspaceVideoPreviewPath(path) ? "video" : "image";
}

function normalizePathKey(path: string): string {
  return path.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
}

function fileNameAsAlt(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  return normalized.split("/").at(-1) ?? path;
}

function pushUnique(
  items: GeneratedMediaItem[],
  seen: Set<string>,
  item: GeneratedMediaItem,
): void {
  if (!isWorkspaceGeneratedMediaPath(item.path)) return;
  const key = normalizePathKey(item.path);
  if (seen.has(key)) return;
  seen.add(key);
  items.push({ ...item, kind: mediaKindForPath(item.path) });
}

function collectMarkdownSources(markdownText: string): Array<{ src: string; alt: string }> {
  const found: Array<{ src: string; alt: string }> = [];
  for (const match of markdownText.matchAll(MARKDOWN_MEDIA_PATTERN)) {
    const src = match[2]?.trim();
    if (!src) continue;
    found.push({ src, alt: match[1]?.trim() ?? "" });
  }
  for (const match of markdownText.matchAll(HTML_MEDIA_PATTERN)) {
    const src = match[1]?.trim();
    if (!src) continue;
    found.push({ src, alt: "" });
  }
  return found;
}

/**
 * Collects session-folder image/video files written during a turn.
 * Checkpoint and tool paths are the source of truth; markdown links are
 * extra hints when the model mentioned a workspace file in prose.
 */
export function harvestGeneratedMedia(input: {
  readonly markdownText?: string | null;
  readonly checkpointPaths?: ReadonlyArray<string>;
  readonly toolPaths?: ReadonlyArray<string>;
  readonly workspaceRoot?: string | null;
}): GeneratedMediaItem[] {
  const items: GeneratedMediaItem[] = [];
  const seen = new Set<string>();
  const workspaceRoot = input.workspaceRoot ?? null;

  if (input.markdownText) {
    for (const { src, alt } of collectMarkdownSources(input.markdownText)) {
      const classified = classifyMarkdownImageSource(src, workspaceRoot);
      if (classified._tag !== "WorkspaceFile") continue;
      pushUnique(items, seen, {
        path: classified.path,
        kind: "image",
        alt: alt.length > 0 ? alt : fileNameAsAlt(classified.path),
        source: "markdown",
      });
    }
  }

  for (const path of input.checkpointPaths ?? []) {
    const classified = classifyMarkdownImageSource(path, workspaceRoot);
    const resolved = classified._tag === "WorkspaceFile" ? classified.path : path;
    pushUnique(items, seen, {
      path: resolved,
      kind: "image",
      alt: fileNameAsAlt(path),
      source: "checkpoint",
    });
  }

  for (const path of input.toolPaths ?? []) {
    const classified = classifyMarkdownImageSource(path, workspaceRoot);
    const resolved = classified._tag === "WorkspaceFile" ? classified.path : path;
    pushUnique(items, seen, {
      path: resolved,
      kind: "image",
      alt: fileNameAsAlt(path),
      source: "tool",
    });
  }

  return items;
}

export function generatedMediaNotInMarkdown(
  items: ReadonlyArray<GeneratedMediaItem>,
): GeneratedMediaItem[] {
  const markdownKeys = new Set(
    items.filter((item) => item.source === "markdown").map((item) => normalizePathKey(item.path)),
  );
  return items.filter((item) => !markdownKeys.has(normalizePathKey(item.path)));
}
