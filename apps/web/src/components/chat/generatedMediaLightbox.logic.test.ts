import { describe, expect, it } from "vite-plus/test";

import {
  mediaFileName,
  mediaPositionLabel,
  stepMediaIndex,
} from "./generatedMediaLightbox.logic.ts";

describe("stepMediaIndex", () => {
  it("wraps past the end back to the start", () => {
    expect(stepMediaIndex(2, 1, 3)).toBe(0);
  });

  it("wraps before the start to the end", () => {
    expect(stepMediaIndex(0, -1, 3)).toBe(2);
  });

  it("stays put on a single item", () => {
    expect(stepMediaIndex(0, 1, 1)).toBe(0);
    expect(stepMediaIndex(0, -1, 1)).toBe(0);
  });

  it("survives an empty strip rather than returning NaN", () => {
    expect(stepMediaIndex(0, 1, 0)).toBe(0);
  });
});

describe("mediaFileName", () => {
  it("takes the last segment of a posix path", () => {
    expect(mediaFileName("/repo/assets/hero-sunset.png")).toBe("hero-sunset.png");
  });

  it("splits Windows paths too, since the agent may run on Windows", () => {
    expect(mediaFileName("C:\\repo\\assets\\hero-sunset.png")).toBe("hero-sunset.png");
  });

  it("ignores a trailing separator instead of returning empty", () => {
    expect(mediaFileName("/repo/assets/")).toBe("assets");
  });

  it("returns a bare name unchanged", () => {
    expect(mediaFileName("hero.png")).toBe("hero.png");
  });
});

describe("mediaPositionLabel", () => {
  it("counts from one", () => {
    expect(mediaPositionLabel(2, 8)).toBe("3 of 8");
  });

  it("says nothing when there is only one item to look at", () => {
    expect(mediaPositionLabel(0, 1)).toBeNull();
  });
});
