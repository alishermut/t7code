import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { searchSidebarThreadsByTitle } from "../Sidebar.logic";
import { buildThreadRouteParams } from "../../threadRoutes";
import { useThreadSearch } from "../../state/queries";
import { useEnvironments } from "../../state/environments";
import { useProjects, useThreadShells } from "../../state/entities";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";

const RECENT_SESSION_LIMIT = 8;

export function SessionSearchPopover() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const threads = useThreadShells();
  const projects = useProjects();
  const { environments } = useEnvironments();
  const environmentIds = useMemo(
    () => environments.map((environment) => environment.environmentId),
    [environments],
  );
  const contentSearch = useThreadSearch(environmentIds, query);
  const projectTitleById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.title] as const)),
    [projects],
  );
  const liveThreads = useMemo(
    () => threads.filter((thread) => thread.archivedAt === null),
    [threads],
  );
  const recentThreads = useMemo(() => {
    return [...liveThreads]
      .sort((left, right) => {
        const leftAt = left.latestUserMessageAt ?? left.updatedAt;
        const rightAt = right.latestUserMessageAt ?? right.updatedAt;
        return rightAt.localeCompare(leftAt);
      })
      .slice(0, RECENT_SESSION_LIMIT);
  }, [liveThreads]);
  const titleMatches = useMemo(
    () => searchSidebarThreadsByTitle(liveThreads, query),
    [liveThreads, query],
  );
  const contentMatchedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const match of contentSearch.matches) {
      keys.add(scopedThreadKey(scopeThreadRef(match.environmentId, match.threadId)));
    }
    return keys;
  }, [contentSearch.matches]);
  const snippetByThreadKey = useMemo(() => {
    const snippets = new Map<string, string>();
    for (const match of contentSearch.matches) {
      const key = scopedThreadKey(scopeThreadRef(match.environmentId, match.threadId));
      if (!snippets.has(key) && match.snippet.length > 0) {
        snippets.set(key, match.snippet);
      }
    }
    return snippets;
  }, [contentSearch.matches]);
  const contentThreads = useMemo(() => {
    if (contentMatchedKeys.size === 0) {
      return [];
    }
    return liveThreads.filter((thread) =>
      contentMatchedKeys.has(scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))),
    );
  }, [contentMatchedKeys, liveThreads]);
  const trimmedQuery = query.trim();
  const results =
    trimmedQuery.length === 0 ? recentThreads : mergeUniqueThreads(titleMatches, contentThreads);

  const openThread = (
    environmentId: (typeof liveThreads)[number]["environmentId"],
    threadId: (typeof liveThreads)[number]["id"],
  ) => {
    setOpen(false);
    setQuery("");
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(environmentId, threadId)),
    });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            size="xs"
            variant="outline"
            type="button"
            aria-label="Search sessions"
            title="Search sessions"
            data-toolbar-control=""
            className="w-7 px-0 sm:w-6 [-webkit-app-region:no-drag]"
          />
        }
      >
        <SearchIcon className="size-3.5" />
      </PopoverTrigger>
      <PopoverPopup
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-80 rounded-xl p-0"
        viewportClassName="p-2"
      >
        <Input
          nativeInput
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search sessions"
          aria-label="Search sessions"
          className="mb-2"
        />
        {results.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {trimmedQuery.length === 0
              ? "No recent sessions"
              : contentSearch.isPending
                ? "Searching…"
                : "No matching sessions"}
          </p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-px overflow-y-auto">
            {results.map((thread) => {
              const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
              const snippet = snippetByThreadKey.get(key);
              return (
                <li key={key} className="list-none">
                  <button
                    type="button"
                    onClick={() => openThread(thread.environmentId, thread.id)}
                    className="flex w-full cursor-pointer flex-col rounded-md px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <span className="truncate text-sm text-foreground">{thread.title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {snippet ?? projectTitleById.get(thread.projectId) ?? "Session"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverPopup>
    </Popover>
  );
}

function mergeUniqueThreads<T extends { environmentId: string; id: string }>(
  primary: ReadonlyArray<T>,
  extra: ReadonlyArray<T>,
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const thread of [...primary, ...extra]) {
    const key = `${thread.environmentId}:${thread.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(thread);
  }
  return merged;
}
