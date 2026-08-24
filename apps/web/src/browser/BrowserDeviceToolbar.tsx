"use client";

import {
  PREVIEW_VIEWPORT_MAX_AREA,
  PREVIEW_VIEWPORT_MAX_DIMENSION,
  PREVIEW_VIEWPORT_MIN_DIMENSION,
  type PreviewViewportSetting,
} from "@t3tools/contracts";
import { PREVIEW_VIEWPORT_PRESETS, resolvePreviewViewport } from "@t3tools/shared/previewViewport";
import { Link2, Unlink2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

import { BROWSER_DEVICE_TOOLBAR_HEIGHT, resizeFreeformViewport } from "./browserViewportLayout";
import {
  commitViewportAndAspectRatio,
  DEVICE_TOOLBAR_FILL_VALUE,
  DEVICE_TOOLBAR_RESPONSIVE_VALUE,
  deviceToolbarSettingFromSelection,
  resolveDeviceToolbarDisplayedSize,
  resolveDeviceToolbarSelection,
} from "./browserDeviceToolbarState";
import { ScreenRotationIcon } from "./ScreenRotationIcon";

const PRESET_SELECT_ITEMS = PREVIEW_VIEWPORT_PRESETS.map((preset) => ({
  value: preset.id,
  label: preset.label,
}));

interface Props {
  readonly setting: PreviewViewportSetting;
  readonly width: number;
  readonly panelSize?: { readonly width: number; readonly height: number } | null;
  readonly aspectRatio: number | null;
  readonly onAspectRatioChange: (aspectRatio: number | null) => void;
  readonly onChange: (setting: PreviewViewportSetting) => Promise<void>;
  readonly variant?: "overlay" | "workspace";
  readonly disabled?: boolean;
}

export function BrowserDeviceToolbar({
  setting,
  width,
  panelSize = null,
  aspectRatio,
  onAspectRatioChange,
  onChange,
  variant = "overlay",
  disabled = false,
}: Props) {
  const workspace = variant === "workspace";
  const [pending, setPending] = useState(false);
  const [customSize, setCustomSize] = useState<{
    readonly width: string;
    readonly height: string;
  } | null>(null);
  const displayedSize = resolveDeviceToolbarDisplayedSize(setting, panelSize);
  const presentedSize = customSize ?? {
    width: String(displayedSize.width),
    height: String(displayedSize.height),
  };
  const selectedValue = resolveDeviceToolbarSelection(setting);
  const selectItems = workspace
    ? [
        { value: DEVICE_TOOLBAR_FILL_VALUE, label: "Fill" },
        { value: DEVICE_TOOLBAR_RESPONSIVE_VALUE, label: "Responsive" },
        ...PRESET_SELECT_ITEMS,
      ]
    : [{ value: DEVICE_TOOLBAR_RESPONSIVE_VALUE, label: "Responsive" }, ...PRESET_SELECT_ITEMS];
  const customWidth = Number(presentedSize.width);
  const customHeight = Number(presentedSize.height);
  const customValid =
    Number.isInteger(customWidth) &&
    Number.isInteger(customHeight) &&
    customWidth >= PREVIEW_VIEWPORT_MIN_DIMENSION &&
    customWidth <= PREVIEW_VIEWPORT_MAX_DIMENSION &&
    customHeight >= PREVIEW_VIEWPORT_MIN_DIMENSION &&
    customHeight <= PREVIEW_VIEWPORT_MAX_DIMENSION &&
    customWidth * customHeight <= PREVIEW_VIEWPORT_MAX_AREA;
  const controlsDisabled = pending || disabled;

  const apply = (next: PreviewViewportSetting, nextAspectRatio = aspectRatio) => {
    if (disabled) return;
    setPending(true);
    void commitViewportAndAspectRatio(next, nextAspectRatio, onChange, onAspectRatioChange).then(
      () => {
        setPending(false);
        setCustomSize(null);
      },
      () => setPending(false),
    );
  };

  const applyCustomSize = () => {
    if (
      !customValid ||
      (customWidth === displayedSize.width && customHeight === displayedSize.height)
    ) {
      setCustomSize(null);
      return;
    }
    apply({ _tag: "freeform", width: customWidth, height: customHeight });
  };

  const updateCustomDimension = (axis: "width" | "height", value: string) => {
    setCustomSize((current) => {
      const next = {
        width: axis === "width" ? value : (current?.width ?? String(displayedSize.width)),
        height: axis === "height" ? value : (current?.height ?? String(displayedSize.height)),
      };
      const numeric = Number(value);
      if (
        aspectRatio === null ||
        setting._tag === "fill" ||
        !Number.isInteger(numeric) ||
        numeric < PREVIEW_VIEWPORT_MIN_DIMENSION ||
        numeric > PREVIEW_VIEWPORT_MAX_DIMENSION
      ) {
        return next;
      }
      const resized = resizeFreeformViewport(
        setting,
        axis === "width"
          ? { x: numeric - setting.width, y: 0 }
          : { x: 0, y: numeric - setting.height },
        1,
        axis === "width" ? "east" : "south",
        aspectRatio,
      );
      return { width: String(resized.width), height: String(resized.height) };
    });
  };

  const selectViewport = (value: string | null) => {
    if (!value) return;
    const fromSelection = deviceToolbarSettingFromSelection({
      value,
      setting,
      displayedSize,
    });
    if (fromSelection) {
      apply(fromSelection, fromSelection._tag === "fill" ? null : aspectRatio);
      return;
    }
    if (value === DEVICE_TOOLBAR_RESPONSIVE_VALUE) {
      return;
    }
    const preset = PREVIEW_VIEWPORT_PRESETS.find((candidate) => candidate.id === value);
    if (!preset) return;
    apply(
      resolvePreviewViewport({ mode: "preset", preset: preset.id }),
      aspectRatio === null ? null : preset.width / preset.height,
    );
  };

  const rotate = () => {
    const hasCustomSize =
      customValid && (customWidth !== displayedSize.width || customHeight !== displayedSize.height);
    if (hasCustomSize || setting._tag === "fill") {
      const source = hasCustomSize ? { width: customWidth, height: customHeight } : displayedSize;
      apply(
        { _tag: "freeform", width: source.height, height: source.width },
        aspectRatio === null ? null : 1 / aspectRatio,
      );
      return;
    }
    apply(
      { ...setting, width: setting.height, height: setting.width },
      aspectRatio === null ? null : 1 / aspectRatio,
    );
  };

  const toggleAspectRatio = () => {
    onAspectRatioChange(aspectRatio === null ? customWidth / customHeight : null);
  };

  const dimensionInputClassName = cn(
    "h-6 rounded-md text-center tabular-nums [&_[data-slot=input]]:h-full [&_[data-slot=input]]:px-1 [&_[data-slot=input]]:text-xs [&_[data-slot=input]]:leading-none [&_[data-slot=input]::-webkit-inner-spin-button]:appearance-none [&_[data-slot=input]]:[appearance:textfield]",
    workspace || width >= 360 ? "w-14" : "w-11",
    workspace && "bg-background/80 shadow-none [&_[data-slot=input]]:bg-transparent",
  );

  return (
    <div
      className={
        workspace
          ? "flex h-full min-w-0 items-center gap-1 pl-3 pr-2 [-webkit-app-region:no-drag]"
          : "sticky left-0 top-0 z-50 flex items-center gap-0.5 overflow-x-auto border-b border-border/70 bg-background/95 px-1.5 shadow-xs backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      }
      style={workspace ? undefined : { width, height: BROWSER_DEVICE_TOOLBAR_HEIGHT }}
      role="toolbar"
      aria-label="Browser device toolbar"
      data-browser-device-toolbar
      data-browser-device-toolbar-variant={variant}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        const eventTarget = event.target;
        if (
          (nextTarget instanceof HTMLElement &&
            nextTarget.closest('[data-slot="select-positioner"]')) ||
          (eventTarget instanceof HTMLElement &&
            eventTarget.closest('[data-slot="select-positioner"]'))
        ) {
          return;
        }
        applyCustomSize();
      }}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-0.5",
          workspace && "rounded-lg bg-muted/70 p-0.5 ring-1 ring-border/50",
        )}
      >
        {!workspace && width >= 560 ? (
          <span className="mr-0.5 shrink-0 text-[11px] font-medium text-muted-foreground">
            Dimensions
          </span>
        ) : null}
        <Select
          modal={false}
          value={selectedValue}
          onValueChange={selectViewport}
          items={selectItems}
          disabled={controlsDisabled}
        >
          <SelectTrigger
            variant="ghost"
            size="xs"
            className={cn(
              "shrink-0 justify-between px-1.5 font-medium",
              workspace ? "h-6 w-[8.5rem] rounded-md" : width >= 440 ? "w-36" : "w-24",
            )}
            aria-label="Browser device preset"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectPopup align="start" alignItemWithTrigger={false} className="min-w-64">
            {workspace ? <SelectItem value={DEVICE_TOOLBAR_FILL_VALUE}>Fill</SelectItem> : null}
            <SelectItem value={DEVICE_TOOLBAR_RESPONSIVE_VALUE}>Responsive</SelectItem>
            <SelectGroup>
              <SelectGroupLabel>Devices</SelectGroupLabel>
              {PREVIEW_VIEWPORT_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  <span className="flex w-full items-center justify-between gap-5">
                    <span>{preset.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {preset.detail}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectPopup>
        </Select>

        <form
          className={cn(
            "m-0 flex min-w-0 shrink-0 items-center gap-0.5 border-0 p-0",
            workspace && "rounded-md bg-background/70 px-0.5",
          )}
          aria-label="Viewport dimensions"
          onSubmit={(event) => {
            event.preventDefault();
            applyCustomSize();
          }}
        >
          <Input
            nativeInput
            type="number"
            inputMode="numeric"
            size="sm"
            min={PREVIEW_VIEWPORT_MIN_DIMENSION}
            max={PREVIEW_VIEWPORT_MAX_DIMENSION}
            value={presentedSize.width}
            disabled={controlsDisabled}
            onFocus={() =>
              setCustomSize(
                (current) =>
                  current ?? {
                    width: String(displayedSize.width),
                    height: String(displayedSize.height),
                  },
              )
            }
            onChange={(event) => updateCustomDimension("width", event.target.value)}
            aria-label="Viewport width"
            aria-invalid={!customValid}
            className={dimensionInputClassName}
          />
          <span className="text-xs text-muted-foreground">×</span>
          <Input
            nativeInput
            type="number"
            inputMode="numeric"
            size="sm"
            min={PREVIEW_VIEWPORT_MIN_DIMENSION}
            max={PREVIEW_VIEWPORT_MAX_DIMENSION}
            value={presentedSize.height}
            disabled={controlsDisabled}
            onFocus={() =>
              setCustomSize(
                (current) =>
                  current ?? {
                    width: String(displayedSize.width),
                    height: String(displayedSize.height),
                  },
              )
            }
            onChange={(event) => updateCustomDimension("height", event.target.value)}
            aria-label="Viewport height"
            aria-invalid={!customValid}
            className={dimensionInputClassName}
          />
        </form>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                type="button"
                aria-label={
                  aspectRatio === null
                    ? "Lock viewport aspect ratio"
                    : "Unlock viewport aspect ratio"
                }
                aria-pressed={aspectRatio !== null}
                className={cn(aspectRatio !== null && "bg-accent text-foreground")}
                disabled={controlsDisabled || !customValid}
                onPointerDown={(event) => event.preventDefault()}
                onClick={toggleAspectRatio}
              />
            }
          >
            {aspectRatio === null ? (
              <Unlink2 className={cn(aspectRatio !== null && "text-foreground")} />
            ) : (
              <Link2 className={cn(aspectRatio !== null && "text-foreground")} />
            )}
          </TooltipTrigger>
          <TooltipPopup side="top">
            {aspectRatio === null ? "Lock aspect ratio" : "Unlock aspect ratio"}
          </TooltipPopup>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          aria-label="Rotate viewport"
          disabled={controlsDisabled}
          onClick={rotate}
        >
          <ScreenRotationIcon />
        </Button>
        {workspace ? null : (
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            aria-label="Close device toolbar"
            className="sticky right-0 ml-auto bg-background/95"
            disabled={controlsDisabled}
            onClick={() => {
              apply({ _tag: "fill" }, null);
            }}
          >
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}
