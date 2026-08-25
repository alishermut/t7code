import { describe, expect, it } from "vite-plus/test";

import { generatedMediaNotInMarkdown, harvestGeneratedMedia } from "./generatedMedia.ts";

describe("harvestGeneratedMedia", () => {
  it("collects image and video files from the turn checkpoint", () => {
    const items = harvestGeneratedMedia({
      checkpointPaths: ["src/index.ts", "images/hero.png", "preview/walk.mp4", "README.md"],
      workspaceRoot: "/repo",
    });

    expect(items).toEqual([
      {
        path: "/repo/images/hero.png",
        kind: "image",
        alt: "hero.png",
        source: "checkpoint",
      },
      {
        path: "/repo/preview/walk.mp4",
        kind: "video",
        alt: "walk.mp4",
        source: "checkpoint",
      },
    ]);
  });

  it("resolves relative markdown media against the session workspace", () => {
    const items = harvestGeneratedMedia({
      markdownText:
        'Here is the mark:\n\n![Brass C on forest green](images/1.jpg)\n\n<video src="clips/intro.webm"></video>',
      workspaceRoot: "/Users/dev/project",
    });

    expect(
      items.map((item) => ({ path: item.path, kind: item.kind, source: item.source })),
    ).toEqual([
      {
        path: "/Users/dev/project/images/1.jpg",
        kind: "image",
        source: "markdown",
      },
      {
        path: "/Users/dev/project/clips/intro.webm",
        kind: "video",
        source: "markdown",
      },
    ]);
    expect(items[0]?.alt).toBe("Brass C on forest green");
  });

  it("ignores blocked markdown schemes and remote URLs", () => {
    const items = harvestGeneratedMedia({
      markdownText:
        "![remote](https://example.com/a.png)\n![sandbox](sandbox:/mnt/data/x.png)\n![empty]()",
      workspaceRoot: "/repo",
    });
    expect(items).toEqual([]);
  });

  it("dedupes the same file from markdown and the checkpoint", () => {
    const items = harvestGeneratedMedia({
      markdownText: "![Hero](images/hero.png)",
      checkpointPaths: ["images/hero.png"],
      workspaceRoot: "/repo",
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.source).toBe("markdown");
    expect(generatedMediaNotInMarkdown(items)).toEqual([]);
  });

  it("keeps checkpoint media that markdown did not mention", () => {
    const items = harvestGeneratedMedia({
      markdownText: "![Hero](images/hero.png)",
      checkpointPaths: ["images/hero.png", "images/alt.webp"],
      workspaceRoot: "/repo",
    });
    expect(generatedMediaNotInMarkdown(items).map((item) => item.path)).toEqual([
      "/repo/images/alt.webp",
    ]);
  });
});
