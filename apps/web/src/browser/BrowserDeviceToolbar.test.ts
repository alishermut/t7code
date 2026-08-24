import { FILL_PREVIEW_VIEWPORT, type PreviewViewportSetting } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  commitViewportAndAspectRatio,
  deviceToolbarSettingFromSelection,
  reconcileLockedAspectRatio,
  resolveDeviceToolbarDisplayedSize,
  resolveDeviceToolbarSelection,
} from "./browserDeviceToolbarState";

describe("device toolbar selection", () => {
  it("maps fill, presets, and freeform sizes to select values", () => {
    expect(resolveDeviceToolbarSelection(FILL_PREVIEW_VIEWPORT)).toBe("fill");
    expect(
      resolveDeviceToolbarSelection({
        _tag: "preset",
        presetId: "iphone-se",
        width: 375,
        height: 667,
      }),
    ).toBe("iphone-se");
    expect(resolveDeviceToolbarSelection({ _tag: "freeform", width: 1280, height: 800 })).toBe(
      "responsive",
    );
  });

  it("shows the panel size while the viewport fills the surface", () => {
    expect(
      resolveDeviceToolbarDisplayedSize(FILL_PREVIEW_VIEWPORT, { width: 1180.4, height: 742.2 }),
    ).toEqual({ width: 1180, height: 742 });
    expect(
      resolveDeviceToolbarDisplayedSize(
        { _tag: "freeform", width: 390, height: 844 },
        { width: 1180, height: 742 },
      ),
    ).toEqual({ width: 390, height: 844 });
  });

  it("turns fill into a freeform viewport when Responsive is chosen", () => {
    expect(
      deviceToolbarSettingFromSelection({
        value: "responsive",
        setting: FILL_PREVIEW_VIEWPORT,
        displayedSize: { width: 1280, height: 800 },
      }),
    ).toEqual({ _tag: "freeform", width: 1280, height: 800 });
    expect(
      deviceToolbarSettingFromSelection({
        value: "fill",
        setting: { _tag: "freeform", width: 390, height: 844 },
        displayedSize: { width: 390, height: 844 },
      }),
    ).toEqual(FILL_PREVIEW_VIEWPORT);
    expect(
      deviceToolbarSettingFromSelection({
        value: "responsive",
        setting: { _tag: "freeform", width: 1280, height: 800 },
        displayedSize: { width: 1280, height: 800 },
      }),
    ).toBeNull();
  });
});

describe("commitViewportAndAspectRatio", () => {
  it("commits the aspect ratio only after the viewport succeeds", async () => {
    let resolveChange: (() => void) | undefined;
    const onChange = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveChange = resolve;
        }),
    );
    const onAspectRatioChange = vi.fn();
    const setting: PreviewViewportSetting = { _tag: "freeform", width: 900, height: 600 };

    const commit = commitViewportAndAspectRatio(setting, 1.5, onChange, onAspectRatioChange);
    expect(onAspectRatioChange).not.toHaveBeenCalled();

    resolveChange?.();
    await commit;
    expect(onAspectRatioChange).toHaveBeenCalledWith(1.5);
  });

  it("keeps the previous aspect ratio when the viewport commit fails", async () => {
    const onAspectRatioChange = vi.fn();
    await expect(
      commitViewportAndAspectRatio(
        { _tag: "fill" },
        null,
        async () => Promise.reject(new Error("resize failed")),
        onAspectRatioChange,
      ),
    ).rejects.toThrow("resize failed");
    expect(onAspectRatioChange).not.toHaveBeenCalled();
  });
});

describe("reconcileLockedAspectRatio", () => {
  it("tracks external viewport ratios only while the lock remains active", () => {
    expect(reconcileLockedAspectRatio(1.5, 16 / 9)).toBe(16 / 9);
    expect(reconcileLockedAspectRatio(null, 16 / 9)).toBeNull();
    expect(reconcileLockedAspectRatio(1.5, null)).toBeNull();
  });
});
