import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { effectiveSettled, effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useClientSettings } from "../../hooks/useSettings";
import { useNowMinute } from "../../hooks/useNowMinute";
import { useThreadActions } from "../../hooks/useThreadActions";
import { useArchivedThreadSnapshots } from "../../lib/archivedThreadsState";
import { useEnvironments } from "../../state/environments";
import { useProjects, useThreadShells } from "../../state/entities";
import { useThreadSearch } from "../../state/queries";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { buildThreadRouteParams } from "../../threadRoutes";
import { cn } from "../../lib/utils";
import { Dialog, DialogPopup, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import {
  groupSessionsByRecency,
  sessionActivityAt,
  SESSION_LIFECYCLE_LABEL,
  SESSION_RECENCY_LABEL,
  type SessionLifecycle,
} from "./sessionSearch.logic";

interface SearchSession {
  readonly environmentId: EnvironmentId;
  readonly id: ThreadId;
  readonly title: string;
  readonly projectId: string;
  readonly archivedAt: string | null;
  readonly latestUserMessageAt: string | null;
  readonly updatedAt: string;
  readonly snoozedUntil: string | null;
  readonly settledAt: string | null;
  readonly snippet: string | null;
  readonly lifecycle: SessionLifecycle;
}

export function SessionSearchDialog({
  open,
  onOpenChange,
  onNewThread,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onNewThread: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const navigate = useNavigate();
  const threads = useThreadShells();
  const projects = useProjects();
  const { environments } = useEnvironments();
  const nowMinute = useNowMinute();
  const autoSettleAfterDays = useClientSettings((settings) => settings.sidebarAutoSettleAfterDays);
  const { unarchiveThread } = useThreadActions();
  const environmentIds = useMemo(
    () => environments.map((environment) => environment.environmentId),
    [environments],
  );
  const archived = useArchivedThreadSnapshots(open ? environmentIds : []);
  const contentSearch = useThreadSearch(environmentIds, query);
  const nowMs = Date.parse(`${nowMinute}:00.000Z`);
  const preciseNow = new Date().toISOString();
  const projectTitleByKey = useMemo(
    () =>
      new Map(projects.map((project) => [`${project.environmentId}:${project.id}`, project.title])),
    [projects],
  );

  const catalog = useMemo(() => {
    const byKey = new Map<string, SearchSession>();
    const add = (session: SearchSession) => {
      byKey.set(`${session.environmentId}:${session.id}`, session);
    };
    for (const thread of threads) {
      const snoozed = effectiveSnoozed(thread, { now: preciseNow });
      const settled = effectiveSettled(thread, {
        now: `${nowMinute}:00.000Z`,
        autoSettleAfterDays,
      });
      add({
        environmentId: thread.environmentId,
        id: thread.id,
        title: thread.title,
        projectId: thread.projectId,
        archivedAt: thread.archivedAt,
        latestUserMessageAt: thread.latestUserMessageAt,
        updatedAt: thread.updatedAt,
        snoozedUntil: thread.snoozedUntil ?? null,
        settledAt: thread.settledAt ?? null,
        snippet: null,
        lifecycle:
          thread.archivedAt !== null
            ? "archived"
            : snoozed
              ? "snoozed"
              : settled
                ? "done"
                : "active",
      });
    }
    for (const entry of archived.snapshots) {
      for (const thread of entry.snapshot.threads) {
        add({
          environmentId: entry.environmentId,
          id: thread.id,
          title: thread.title,
          projectId: thread.projectId,
          archivedAt: thread.archivedAt,
          latestUserMessageAt: thread.latestUserMessageAt,
          updatedAt: thread.updatedAt,
          snoozedUntil: thread.snoozedUntil ?? null,
          settledAt: thread.settledAt ?? null,
          snippet: null,
          lifecycle: "archived",
        });
      }
    }
    return [...byKey.values()];
  }, [archived.snapshots, autoSettleAfterDays, nowMinute, preciseNow, threads]);

  const trimmedQuery = query.trim().toLowerCase();
  const snippetByKey = useMemo(() => {
    const snippets = new Map<string, string>();
    for (const match of contentSearch.matches) {
      const key = `${match.environmentId}:${match.threadId}`;
      if (!snippets.has(key) && match.snippet.length > 0) {
        snippets.set(key, match.snippet);
      }
    }
    return snippets;
  }, [contentSearch.matches]);

  const results = useMemo(() => {
    const contentKeys = new Set(snippetByKey.keys());
    const matched =
      trimmedQuery.length === 0
        ? catalog
        : catalog.filter((session) => {
            const key = `${session.environmentId}:${session.id}`;
            const projectTitle =
              projectTitleByKey.get(`${session.environmentId}:${session.projectId}`) ?? "";
            return (
              session.title.toLowerCase().includes(trimmedQuery) ||
              projectTitle.toLowerCase().includes(trimmedQuery) ||
              contentKeys.has(key)
            );
          });
    return matched.map((session) => ({
      ...session,
      snippet: snippetByKey.get(`${session.environmentId}:${session.id}`) ?? null,
    }));
  }, [catalog, projectTitleByKey, snippetByKey, trimmedQuery]);

  const grouped = useMemo(
    () =>
      groupSessionsByRecency(results, Number.isNaN(nowMs) ? Date.now() : nowMs, (session) =>
        sessionActivityAt(session),
      ),
    [nowMs, results],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedKey(null);
    }
  }, [open]);

  useEffect(() => {
    if (
      selectedKey !== null &&
      results.some((session) => `${session.environmentId}:${session.id}` === selectedKey)
    ) {
      return;
    }
    setSelectedKey(results[0] ? `${results[0].environmentId}:${results[0].id}` : null);
  }, [results, selectedKey]);

  const selected =
    results.find((session) => `${session.environmentId}:${session.id}` === selectedKey) ?? null;

  const openSession = async (session: SearchSession) => {
    const threadRef = scopeThreadRef(session.environmentId, session.id);
    if (session.lifecycle === "archived") {
      await unarchiveThread(threadRef);
    }
    onOpenChange(false);
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(threadRef),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        showCloseButton={false}
        className="flex h-[min(40rem,85vh)] max-w-5xl overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Search sessions</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
          <Input
            nativeInput
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search titles, prompts, and replies…"
            aria-label="Search sessions"
            className="min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(16rem,22rem)_1fr]">
          <div className="min-h-0 overflow-auto border-b border-border/70 md:border-r md:border-b-0">
            <button
              type="button"
              className="flex w-full cursor-pointer items-center px-4 py-2.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                onOpenChange(false);
                onNewThread();
              }}
            >
              New thread
            </button>
            {contentSearch.isPending && trimmedQuery.length >= 2 ? (
              <p className="px-4 py-2 text-xs text-muted-foreground">Searching content…</p>
            ) : null}
            {grouped.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {trimmedQuery.length === 0 ? "No recent sessions" : "No matching sessions"}
              </p>
            ) : (
              grouped.map((group) => (
                <section key={group.group} className="px-2 py-2">
                  <h2 className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                    {SESSION_RECENCY_LABEL[group.group]}
                  </h2>
                  <ul className="flex flex-col">
                    {group.sessions.map((session) => {
                      const key = `${session.environmentId}:${session.id}`;
                      const active = key === selectedKey;
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            className={cn(
                              "flex w-full cursor-pointer flex-col rounded-md px-2 py-1.5 text-left",
                              active ? "bg-accent" : "hover:bg-accent/70",
                            )}
                            onClick={() => setSelectedKey(key)}
                            onDoubleClick={() => void openSession(session)}
                          >
                            <span className="truncate text-sm text-foreground">
                              {session.title}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {SESSION_LIFECYCLE_LABEL[session.lifecycle]}
                              {" · "}
                              {formatRelativeTimeLabel(sessionActivityAt(session))}
                            </span>
                            {session.snippet ? (
                              <span className="line-clamp-2 text-xs text-muted-foreground">
                                {session.snippet}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
          <div className="min-h-0 overflow-auto p-6">
            {selected === null ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select a conversation to preview
              </p>
            ) : (
              <div className="grid gap-3">
                <div>
                  <h3 className="text-base font-medium">{selected.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {projectTitleByKey.get(`${selected.environmentId}:${selected.projectId}`) ??
                      "Project"}
                    {" · "}
                    {SESSION_LIFECYCLE_LABEL[selected.lifecycle]}
                  </p>
                </div>
                {selected.snippet ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {selected.snippet}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {trimmedQuery.length === 0
                      ? "Open this session to read the conversation."
                      : "Matched by title. Open the session to read the conversation."}
                  </p>
                )}
                <button
                  type="button"
                  className="w-fit cursor-pointer text-sm text-foreground underline-offset-4 hover:underline"
                  onClick={() => void openSession(selected)}
                >
                  Open session
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}

export type { SearchSession };
