import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { PlusIcon, XIcon } from "lucide-react";
import { useMemo } from "react";

import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

export interface ThreadTabItem {
  readonly threadKey: string;
  readonly title: string;
  readonly spaceName: string | null;
}

export function ThreadTabBar({
  tabs,
  activeThreadKey,
  onSelect,
  onClose,
  onNew,
}: {
  readonly tabs: ReadonlyArray<ThreadTabItem>;
  readonly activeThreadKey: string | null;
  readonly onSelect: (threadRef: ScopedThreadRef) => void;
  readonly onClose: (threadKey: string) => void;
  readonly onNew: () => void;
}) {
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => parseScopedThreadKey(tab.threadKey) !== null),
    [tabs],
  );
  if (visibleTabs.length === 0 && activeThreadKey === null) {
    return null;
  }

  return (
    <div
      className="flex h-10 shrink-0 items-center overflow-hidden border-b border-border/70 bg-background px-2"
      data-thread-tab-bar=""
    >
      <div className="flex h-full min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibleTabs.map((tab) => {
          const threadRef = parseScopedThreadKey(tab.threadKey);
          if (threadRef === null) return null;
          const active = tab.threadKey === activeThreadKey;
          return (
            <div
              key={tab.threadKey}
              className={cn(
                "group/tab relative flex h-full min-w-0 max-w-52 shrink-0 items-center",
                active &&
                  "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground",
              )}
            >
              <div
                className={cn(
                  "flex min-w-0 items-center rounded-full py-1 pl-3 transition-colors duration-150 ease-out motion-reduce:transition-none",
                  active
                    ? "bg-zinc-200/90 pr-1.5 text-foreground dark:bg-white/12"
                    : "pr-1.5 text-muted-foreground hover:bg-zinc-200/60 hover:text-foreground dark:hover:bg-white/8",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer truncate text-left text-[13px] font-medium"
                  onClick={() => onSelect(threadRef)}
                >
                  {tab.title}
                </button>
                <button
                  type="button"
                  className={cn(
                    "inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground",
                    !active && "opacity-0 group-hover/tab:opacity-100",
                  )}
                  aria-label={`Close ${tab.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(tab.threadKey);
                  }}
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            </div>
          );
        })}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="ml-0.5 shrink-0 cursor-pointer text-muted-foreground"
                aria-label="New thread tab"
                onClick={onNew}
              >
                <PlusIcon className="size-3.5" />
              </Button>
            }
          />
          <TooltipPopup side="bottom">New thread</TooltipPopup>
        </Tooltip>
      </div>
    </div>
  );
}
