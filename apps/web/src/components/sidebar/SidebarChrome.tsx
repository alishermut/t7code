import {
  ArrowLeftIcon,
  ChartNoAxesColumnIcon,
  GitPullRequestIcon,
  MessageSquareIcon,
  PanelLeftIcon,
  SettingsIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { memo, useCallback } from "react";
import { useCanGoBack, useLocation, useNavigate } from "@tanstack/react-router";

import { useEnvironmentIdentificationMode } from "../../hooks/useSettings";
import { cn } from "../../lib/utils";
import { useEnvironments } from "../../state/environments";
import { useUiStateStore } from "../../uiStateStore";
import {
  resolveEnvironmentIdentificationPillLabel,
  resolveSidebarStageBackdropVariant,
  resolveSidebarStageFocusRingOffsetClass,
  SidebarStageBackdrop,
  useEnvironmentStageLabel,
} from "../SidebarStageBackdrop";
import { Badge } from "../ui/badge";
import {
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "../ui/sidebar";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { SidebarProviderUpdatePill } from "./SidebarProviderUpdatePill";
import { SidebarUpdateArchitectureWarning, SidebarUpdatePill } from "./SidebarUpdatePill";

export const SidebarChromeHeader = memo(function SidebarChromeHeader({
  isElectron,
}: {
  isElectron: boolean;
}) {
  const stageLabel = useEnvironmentStageLabel();
  const environmentIdentificationMode = useEnvironmentIdentificationMode();
  const backdropVariant = resolveSidebarStageBackdropVariant(
    stageLabel,
    environmentIdentificationMode === "artwork",
  );
  const pillLabel =
    environmentIdentificationMode === "pill"
      ? resolveEnvironmentIdentificationPillLabel(stageLabel)
      : null;

  return (
    <SidebarHeader
      className={cn(
        "@container/sidebar-header relative h-[var(--workspace-topbar-height)] shrink-0 flex-row items-center gap-1 px-3 py-0 md:px-0",
        isElectron && "drag-region",
      )}
    >
      {backdropVariant ? <SidebarStageBackdrop variant={backdropVariant} /> : null}
      <SidebarTrigger
        className={cn(
          "relative z-10 md:hidden",
          backdropVariant &&
            "focus-visible:ring-white/90 [&_svg]:stroke-white/90! [&_svg]:opacity-100! [&_svg]:hover:stroke-white! [:hover,[data-pressed]]:bg-white/15",
          backdropVariant && resolveSidebarStageFocusRingOffsetClass(backdropVariant),
        )}
      />
      <WorkspaceModeToggle onBackdrop={backdropVariant !== null} />
      <div className="relative z-10 ml-auto flex shrink-0 items-center gap-0.5 pr-1 [-webkit-app-region:no-drag] md:pr-1.5">
        <WorkspaceLeftPaneToggle />
        <SidebarTrigger
          className={cn(
            "hidden md:inline-flex",
            backdropVariant &&
              "focus-visible:ring-white/90 [&_svg]:stroke-white/90! [&_svg]:opacity-100! [&_svg]:hover:stroke-white! [:hover,[data-pressed]]:bg-white/15",
            backdropVariant && resolveSidebarStageFocusRingOffsetClass(backdropVariant),
          )}
        />
      </div>
      {pillLabel ? (
        <Badge
          className="relative z-10 rounded-full px-1.5 text-muted-foreground"
          data-environment-identification="pill"
          size="sm"
          variant="secondary"
        >
          {pillLabel}
        </Badge>
      ) : null}
    </SidebarHeader>
  );
});

function WorkspaceModeToggle({ onBackdrop }: { onBackdrop: boolean }) {
  const workspaceMode = useUiStateStore((state) => state.workspaceMode);
  const setWorkspaceMode = useUiStateStore((state) => state.setWorkspaceMode);

  return (
    <ToggleGroup
      variant="segmented"
      className={cn(
        "relative z-10 ml-0 flex min-w-0 shrink-0 gap-px rounded-md p-px [-webkit-app-region:no-drag] md:ml-[var(--workspace-controls-left)] [&_[data-slot=toggle]]:h-5 [&_[data-slot=toggle]]:min-h-5 [&_[data-slot=toggle]]:px-1.5 [&_[data-slot=toggle]]:text-[11px] [&_[data-slot=toggle]]:leading-none",
        onBackdrop && "bg-white/15",
      )}
      value={[workspaceMode]}
      onValueChange={(value) => {
        const next = value[0];
        if (next === "agent" || next === "editor" || next === "browser") {
          setWorkspaceMode(next);
        }
      }}
    >
      <Toggle value="agent" aria-label="Agent">
        Agent
      </Toggle>
      <Toggle value="editor" aria-label="Editor">
        Editor
      </Toggle>
      <Toggle value="browser" aria-label="Browser">
        Browser
      </Toggle>
    </ToggleGroup>
  );
}

function WorkspaceLeftPaneToggle() {
  const workspaceMode = useUiStateStore((state) => state.workspaceMode);
  const workspaceLeftPane = useUiStateStore((state) => state.workspaceLeftPane);
  const setWorkspaceLeftPane = useUiStateStore((state) => state.setWorkspaceLeftPane);

  if (workspaceMode === "agent") {
    return null;
  }

  const showingSessions = workspaceLeftPane === "sessions";
  return (
    <SidebarMenuButton
      size="icon"
      type="button"
      className="relative shrink-0 [-webkit-app-region:no-drag]"
      aria-label={showingSessions ? "Show chat" : "Show sessions"}
      title={showingSessions ? "Show chat" : "Show sessions"}
      onClick={() => setWorkspaceLeftPane(showingSessions ? "chat" : "sessions")}
    >
      {showingSessions ? <MessageSquareIcon /> : <PanelLeftIcon />}
    </SidebarMenuButton>
  );
}

function SidebarUtilityItem({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton aria-label={label} onClick={onClick} size="icon">
              {icon}
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">{label}</TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}

export const SidebarUtilityMenu = memo(function SidebarUtilityMenu() {
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const { isMobile, setOpenMobile } = useSidebar();
  const currentFooterPage = useLocation({
    select: (location) =>
      /^\/settings(?:\/|$)/.test(location.pathname)
        ? "settings"
        : location.pathname === "/usage"
          ? "usage"
          : location.pathname === "/pull-requests"
            ? "pull-requests"
            : location.pathname === "/tasks"
              ? "tasks"
              : null,
  });
  const { environments } = useEnvironments();
  // The page reads every connected server, so one of them offering pull requests is enough for
  // the link to lead somewhere.
  const pullRequestsSupported = environments.some(
    (environment) => environment.serverConfig?.environment.capabilities.pullRequests === true,
  );
  const closeMobileSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);
  const handlePullRequestsClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({ to: "/pull-requests", search: { involvement: "all", state: "open" } });
  }, [closeMobileSidebar, navigate]);
  const handleSettingsClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({ to: "/settings" });
  }, [closeMobileSidebar, navigate]);

  const handleUsageClick = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
    void navigate({ to: "/usage" });
  }, [isMobile, navigate, setOpenMobile]);

  const handleBackClick = useCallback(() => {
    closeMobileSidebar();
    if (canGoBack) {
      window.history.back();
      return;
    }
    void navigate({ to: "/" });
  }, [canGoBack, closeMobileSidebar, navigate]);

  return (
    <SidebarMenu className="flex-row items-center">
      {currentFooterPage ? (
        <SidebarMenuItem className="min-w-0 flex-1">
          <SidebarMenuButton onClick={handleBackClick}>
            <ArrowLeftIcon />
            <span>Back</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ) : (
        <>
          <SidebarUtilityItem
            icon={<SettingsIcon />}
            label="Settings"
            onClick={handleSettingsClick}
          />
          {pullRequestsSupported ? (
            <SidebarUtilityItem
              icon={<GitPullRequestIcon />}
              label="Pull Requests"
              onClick={handlePullRequestsClick}
            />
          ) : null}
          <SidebarUtilityItem
            icon={<ChartNoAxesColumnIcon />}
            label="Usage"
            onClick={handleUsageClick}
          />
        </>
      )}
      <SidebarUpdatePill />
    </SidebarMenu>
  );
});

export const SidebarChromeFooter = memo(function SidebarChromeFooter() {
  return (
    <SidebarFooter className="p-[var(--sidebar-content-inset)]">
      <SidebarProviderUpdatePill />
      <SidebarUpdateArchitectureWarning />
      <SidebarUtilityMenu />
    </SidebarFooter>
  );
});
