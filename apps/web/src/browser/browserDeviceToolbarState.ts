import { FILL_PREVIEW_VIEWPORT, type PreviewViewportSetting } from "@t3tools/contracts";
import { PREVIEW_VIEWPORT_PRESETS } from "@t3tools/shared/previewViewport";

export const DEVICE_TOOLBAR_FILL_VALUE = "fill";
export const DEVICE_TOOLBAR_RESPONSIVE_VALUE = "responsive";

export function resolveDeviceToolbarSelection(setting: PreviewViewportSetting): string {
  if (setting._tag === "fill") return DEVICE_TOOLBAR_FILL_VALUE;
  if (
    setting._tag === "preset" &&
    PREVIEW_VIEWPORT_PRESETS.some((preset) => preset.id === setting.presetId)
  ) {
    return setting.presetId;
  }
  return DEVICE_TOOLBAR_RESPONSIVE_VALUE;
}

export function resolveDeviceToolbarDisplayedSize(
  setting: PreviewViewportSetting,
  panelSize: { readonly width: number; readonly height: number } | null,
): { readonly width: number; readonly height: number } {
  if (setting._tag !== "fill") {
    return { width: setting.width, height: setting.height };
  }
  if (panelSize && panelSize.width > 0 && panelSize.height > 0) {
    return {
      width: Math.max(1, Math.round(panelSize.width)),
      height: Math.max(1, Math.round(panelSize.height)),
    };
  }
  return { width: 1280, height: 800 };
}

export function deviceToolbarSettingFromSelection(input: {
  readonly value: string;
  readonly setting: PreviewViewportSetting;
  readonly displayedSize: { readonly width: number; readonly height: number };
}): PreviewViewportSetting | null {
  if (input.value === DEVICE_TOOLBAR_FILL_VALUE) {
    return FILL_PREVIEW_VIEWPORT;
  }
  if (input.value === DEVICE_TOOLBAR_RESPONSIVE_VALUE) {
    if (input.setting._tag === "freeform") return null;
    return {
      _tag: "freeform",
      width: input.displayedSize.width,
      height: input.displayedSize.height,
    };
  }
  return null;
}

export function reconcileLockedAspectRatio(
  current: number | null,
  viewportAspectRatio: number | null,
): number | null {
  return current === null || viewportAspectRatio === null ? null : viewportAspectRatio;
}

export async function commitViewportAndAspectRatio(
  setting: PreviewViewportSetting,
  aspectRatio: number | null,
  onChange: (setting: PreviewViewportSetting) => Promise<void>,
  onAspectRatioChange: (aspectRatio: number | null) => void,
): Promise<void> {
  await onChange(setting);
  onAspectRatioChange(aspectRatio);
}
