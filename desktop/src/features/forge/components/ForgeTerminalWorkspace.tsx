import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Button, Modal } from "@/shared/ui";
import type {
  ForgeRuntimeRecord,
  ForgeWorkspaceSnapshot,
} from "../types";
import type { ForgeWorkspaceProps } from "./ForgeWorkspace";
import {
  ForgeDispatchModal,
  type ForgeBuilderChoice,
} from "./workspace/ForgeDispatchModal";
import { ForgeRegisterProjectModal } from "./workspace/ForgeRegisterProjectModal";
import { builderLabel, runtimeLabel } from "./workspace/presentation";

const runViewAction = (
  action: void | Promise<void> | undefined,
) => {
  void Promise.resolve(action).catch(() => undefined);
};

const terminalTone = (state: string) => {
  if (
    [
      "completed",
      "review_passed",
      "waiting_integration",
      "integrated",
      "passed",
      "ready",
    ].includes(state)
  ) {
    return "text-success";
  }
  if (
    [
      "failed",
      "cancelled",
      "interrupted",
      "stale",
      "blocked",
      "error",
    ].includes(state)
  ) {
    return "text-danger";
  }
  if (
    [
      "starting",
      "running",
      "building",
      "fixing",
      "reviewing",
      "waiting",
    ].includes(state)
  ) {
    return "text-warning";
  }
  return "text-text-inverted/55";
};

const terminalDot = (state: string) => {
  if (
    [
      "completed",
      "review_passed",
      "waiting_integration",
      "integrated",
      "passed",
    ].includes(state)
  ) {
    return "bg-success";
  }
  if (
    ["failed", "cancelled", "interrupted", "stale"].includes(state)
  ) {
    return "bg-danger";
  }
  if (
    ["starting", "running", "building", "fixing", "reviewing"].includes(
      state,
    )
  ) {
    return "bg-warning";
  }
  return "bg-text-inverted/30";
};

function TerminalKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-ui-control border border-text-inverted/20 px-1 py-0.5 text-[9px] text-text-inverted/70">
      {children}
    </kbd>
  );
}

export interface ForgeTerminalWorkspaceProps
  extends ForgeWorkspaceProps {
  snapshot?: ForgeWorkspaceSnapshot | null;
}

export function ForgeTerminalWorkspace({
  snapshot,
  busy = false,
  onBackToChat,
  onRefresh,
  onSelectProject,
  onSelectTask,
  onRegisterProject,
  onSendMessage,
  onDispatch,
  onCancel,
  onIntegrate,
  onSwitchView,
}: ForgeTerminalWorkspaceProps) {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [cancelTarget, setCancelTarget] =
    useState<ForgeRuntimeRecord | null>(null);
  const [messageText, setMessageText] = useState("");
  const [builderChoice, setBuilderChoice] =
    useState<ForgeBuilderChoice>("codex");

  const selectedProject = useMemo(
    () =>
      snapshot?.projects.find(
        (project) => project.id === snapshot.selectedProjectId,
      ) ??
      snapshot?.projects[0] ??
      null,
    [snapshot],
  );

  const selectedTask = useMemo(
    () =>
      snapshot?.tasks.find(
        (task) => task.id === snapshot.selectedTaskId,
      ) ??
      snapshot?.tasks[0] ??
      null,
    [snapshot],
  );

  const activeRuntime = useMemo(
    () =>
      snapshot?.runtimes.find(
        (runtime) =>
          runtime.state === "starting" ||
          runtime.state === "running",
      ) ?? null,
    [snapshot?.runtimes],
  );

  const selectedRuntime = useMemo(
    () =>
      selectedTask
        ? snapshot?.runtimes.find(
            (runtime) =>
              runtime.taskId === selectedTask.id &&
              (runtime.state === "starting" ||
                runtime.state === "running"),
          ) ?? null
        : null,
    [selectedTask, snapshot?.runtimes],
  );

  useEffect(() => {
    const choices = snapshot?.builderChoices ?? [];
    if (!choices.length || choices.includes(builderChoice)) return;
    setBuilderChoice(
      choices.includes("codex") ? "codex" : choices[0],
    );
  }, [builderChoice, snapshot?.builderChoices]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(
        target.tagName,
      );

      if (event.key === "Escape") {
        setCommandOpen(false);
        setDispatchOpen(false);
        setRegisterOpen(false);
        setCancelTarget(null);
        return;
      }

      if (typing || dispatchOpen || registerOpen || cancelTarget) return;

      if (commandOpen) {
        if (event.key.toLowerCase() === "q") {
          event.preventDefault();
          setCommandOpen(false);
        }
        return;
      }

      const projects = snapshot?.projects ?? [];
      const activeIndex = Math.max(
        projects.findIndex(
          (project) => project.id === snapshot?.selectedProjectId,
        ),
        0,
      );

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = projects[
          Math.min(activeIndex + 1, Math.max(projects.length - 1, 0))
        ];
        if (next) runViewAction(onSelectProject?.(next.id));
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = projects[Math.max(activeIndex - 1, 0)];
        if (next) runViewAction(onSelectProject?.(next.id));
      } else if (event.key === "/") {
        event.preventDefault();
        setCommandOpen(true);
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        runViewAction(onRefresh?.());
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setRegisterOpen(true);
      } else if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        if (selectedTask) setDispatchOpen(true);
      } else if (event.key.toLowerCase() === "x") {
        event.preventDefault();
        if (selectedRuntime) setCancelTarget(selectedRuntime);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    cancelTarget,
    commandOpen,
    dispatchOpen,
    onRefresh,
    onSelectProject,
    registerOpen,
    selectedRuntime,
    selectedTask,
    snapshot?.projects,
    snapshot?.selectedProjectId,
  ]);

  const submitMessage = async () => {
    const value = messageText.trim();
    if (!value || !onSendMessage) return;
    try {
      await onSendMessage(value);
      setMessageText("");
    } catch {
      // The Forge orchestration hook owns user-visible errors.
    }
  };

  const dispatchable =
    selectedTask?.readiness === "ready" &&
    (selectedTask.runtimeState === "waiting" ||
      selectedTask.runtimeState === "fixing");
  const integratable =
    selectedTask?.runtimeState === "review_passed" &&
    Boolean(selectedTask.batchId) &&
    Boolean(selectedTask.currentSha) &&
    selectedTask.currentSha === selectedTask.reviewedSha;

  if (!snapshot || snapshot.projects.length === 0) {
    return (
      <div
        className="flex h-full min-h-0 flex-col bg-ink font-mono text-text-inverted"
        data-testid="forge-terminal-view"
      >
        <header className="flex h-10 shrink-0 items-center gap-3 border-b border-text-inverted/15 px-3 text-[10px]">
          {onBackToChat ? (
            <button
              type="button"
              className="text-text-inverted/55 hover:text-text-inverted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              onClick={onBackToChat}
            >
              ← CHAT
            </button>
          ) : null}
          <strong className="tracking-[0.16em]">MIRA / FORGE</strong>
          <span className="text-text-inverted/40">/ empty workspace</span>
          <div className="ml-auto flex items-center gap-3">
            {onSwitchView ? (
              <button
                type="button"
                className="text-text-inverted/55 hover:text-text-inverted"
                onClick={onSwitchView}
              >
                [ UI ]
              </button>
            ) : null}
            <span className="text-success">● LOCAL</span>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="max-w-lg border-l-2 border-primary pl-4">
            <div className="text-primary">›</div>
            <h1 className="mt-2 text-sm font-semibold tracking-wide">
              workspace is empty
            </h1>
            <p className="mt-2 text-xs leading-6 text-text-inverted/55">
              Register a local repository. Forge keeps Repository Task
              truth and Runtime truth separate.
            </p>
            <button
              type="button"
              className="mt-4 border border-text-inverted/20 px-3 py-2 text-xs hover:border-primary hover:text-primary"
              onClick={() => setRegisterOpen(true)}
            >
              + new project <TerminalKey>n</TerminalKey>
            </button>
          </div>
        </main>
        <footer className="border-t border-text-inverted/15 px-3 py-2 text-[9px] text-text-inverted/45">
          <TerminalKey>n</TerminalKey> new project ·{" "}
          <TerminalKey>esc</TerminalKey> close
        </footer>
        <ForgeRegisterProjectModal
          open={registerOpen}
          busy={busy}
          onClose={() => setRegisterOpen(false)}
          onSubmit={async (values) => {
            if (!onRegisterProject) return;
            await onRegisterProject(values);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-ink font-mono text-text-inverted"
      data-testid="forge-terminal-view"
    >
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-text-inverted/15 px-3 text-[10px]">
        {onBackToChat ? (
          <button
            type="button"
            className="text-text-inverted/55 hover:text-text-inverted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            onClick={onBackToChat}
          >
            ← CHAT
          </button>
        ) : null}
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        <strong className="tracking-[0.16em]">MIRA / FORGE</strong>
        <span className="min-w-0 flex-1 truncate text-text-inverted/45">
          / {selectedProject?.name ?? "workspace"}
        </span>
        {activeRuntime ? (
          <span className="hidden text-warning sm:inline">
            {builderLabel(activeRuntime.builder) +
              " · " +
              activeRuntime.taskId}
          </span>
        ) : null}
        {onSwitchView ? (
          <button
            type="button"
            className="text-text-inverted/55 hover:text-text-inverted"
            onClick={onSwitchView}
            aria-label="Switch to standard Forge view"
          >
            [ UI ]
          </button>
        ) : null}
        <span className="text-success">● LOCAL</span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className="hidden w-56 shrink-0 flex-col border-r border-text-inverted/15 md:flex"
          aria-label="Terminal workspace navigator"
        >
          <div className="flex h-9 items-center justify-between px-3 text-[9px] tracking-[0.12em] text-text-inverted/45">
            <span>WORKSPACES</span>
            <span>{snapshot.projects.length}</span>
          </div>
          <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto px-1.5">
            {snapshot.projects.map((project) => {
              const selected =
                project.id === snapshot.selectedProjectId;
              return (
                <button
                  key={project.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    runViewAction(onSelectProject?.(project.id))
                  }
                  className={
                    "mb-1 flex w-full items-start gap-2 border-l-2 px-2 py-2 text-left text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary " +
                    (selected
                      ? "border-primary bg-surface-primary/10 text-text-inverted"
                      : "border-transparent text-text-inverted/55 hover:bg-surface-primary/5 hover:text-text-inverted")
                  }
                >
                  <span className="w-2 text-primary">
                    {selected ? "›" : " "}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate font-medium">
                      {project.name}
                    </strong>
                    <small className="mt-1 block truncate text-[9px] text-text-inverted/35">
                      {project.branch +
                        " · " +
                        project.activeRuntimeCount +
                        " active"}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="mx-3 mb-3 border-t border-text-inverted/15 pt-3 text-left text-[10px] text-text-inverted/55 hover:text-primary"
            onClick={() => setRegisterOpen(true)}
          >
            + new project <TerminalKey>n</TerminalKey>
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col xl:grid xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="flex min-h-[360px] min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-text-inverted/15 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <div className="text-[9px] font-semibold tracking-[0.12em] text-text-inverted/40">
                  PROJECT STATUS
                </div>
                <h1 className="mt-1 truncate text-lg font-semibold tracking-tight">
                  {selectedProject?.name ?? "workspace"}
                </h1>
                <code className="mt-1 block truncate text-[10px] text-text-inverted/40">
                  {selectedProject?.repositoryPath ?? "no project"}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="border border-text-inverted/20 px-2 py-1 text-[10px] text-text-inverted/60 hover:border-primary hover:text-primary"
                  onClick={() => runViewAction(onRefresh?.())}
                >
                  ↻ <TerminalKey>r</TerminalKey>
                </button>
                <button
                  type="button"
                  className="border border-text-inverted/20 px-2 py-1 text-[10px] text-text-inverted/60 hover:border-primary hover:text-primary md:hidden"
                  onClick={() => setRegisterOpen(true)}
                >
                  + PROJECT
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-text-inverted/15 px-4 py-2.5 text-[10px] text-text-inverted/45 sm:px-5">
              <span>
                <b className="mr-1 text-sm text-text-inverted">
                  {snapshot.tasks.length}
                </b>
                tasks
              </span>
              <span>
                <b className="mr-1 text-sm text-warning">
                  {snapshot.activeRuntimeCount}
                </b>
                active
              </span>
              <span>
                <b className="mr-1 text-sm text-danger">
                  {snapshot.attentionCount}
                </b>
                attention
              </span>
              <span>
                <b className="mr-1 text-sm text-text-inverted">
                  {snapshot.events.length}
                </b>
                events
              </span>
            </div>

            <div className="border-b border-text-inverted/15 px-4 py-2 sm:px-5">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border border-text-inverted/15 px-2.5 py-2 text-[9px] text-text-inverted/45">
                <span className="font-semibold tracking-[0.1em] text-text-inverted/70">
                  RUNTIME
                </span>
                <span className="truncate">
                  {activeRuntime
                    ? builderLabel(activeRuntime.builder) +
                      " · " +
                      activeRuntime.taskId +
                      " · " +
                      activeRuntime.state
                    : "idle"}
                </span>
                <span>
                  {snapshot.activeRuntimeCount +
                    " active · " +
                    snapshot.attentionCount +
                    " attention"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 pb-2 pt-3 text-[9px] tracking-[0.1em] text-text-inverted/45 sm:px-5">
              <span>CURRENT WORK</span>
              <span>
                {selectedTask
                  ? selectedTask.id + " selected"
                  : "no task selected"}
              </span>
            </div>

            <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-3 sm:px-5">
              {snapshot.tasks.length ? (
                <div className="border border-text-inverted/15">
                  {snapshot.tasks.map((task) => {
                    const selected =
                      task.id === snapshot.selectedTaskId;
                    const runtime = snapshot.runtimes.find(
                      (item) => item.taskId === task.id,
                    );
                    return (
                      <button
                        key={task.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          runViewAction(onSelectTask?.(task.id))
                        }
                        onFocus={() =>
                          runViewAction(onSelectTask?.(task.id))
                        }
                        className={
                          "grid min-h-9 w-full grid-cols-[8px_72px_minmax(120px,1fr)_90px_100px] items-center gap-2 border-b border-text-inverted/10 px-2 text-left text-[9px] last:border-b-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary " +
                          (selected
                            ? "bg-surface-primary/10"
                            : "hover:bg-surface-primary/5")
                        }
                      >
                        <span
                          className={
                            "h-1.5 w-1.5 rounded-full " +
                            terminalDot(task.runtimeState)
                          }
                        />
                        <b className="truncate font-medium text-info">
                          {task.id}
                        </b>
                        <span className="truncate text-[10px] text-text-inverted/75">
                          {task.title}
                        </span>
                        <span
                          className={
                            "truncate " +
                            terminalTone(task.runtimeState)
                          }
                        >
                          {runtime
                            ? runtime.state
                            : runtimeLabel[task.runtimeState]}
                        </span>
                        <span
                          className={
                            "truncate text-right " +
                            terminalTone(task.readiness)
                          }
                        >
                          {task.readiness}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="border-l-2 border-primary py-4 pl-3 text-[10px] text-text-inverted/45">
                  <span className="text-primary">›</span>{" "}
                  no repository tasks
                </div>
              )}

              {selectedTask ? (
                <div className="mt-3 border border-text-inverted/15 p-3 text-[9px]">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-text-inverted/40">TASK</span>
                    <b className="text-info">{selectedTask.id}</b>
                    <span className="text-text-inverted/55">
                      repo {selectedTask.repositoryState}
                    </span>
                    <span
                      className={terminalTone(
                        selectedTask.runtimeState,
                      )}
                    >
                      runtime {selectedTask.runtimeState}
                    </span>
                    <span
                      className={terminalTone(
                        selectedTask.readiness,
                      )}
                    >
                      readiness {selectedTask.readiness}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      {dispatchable ? (
                        <button
                          type="button"
                          className="border border-warning px-2 py-1 text-warning hover:bg-surface-primary/5"
                          onClick={() => setDispatchOpen(true)}
                        >
                          dispatch <TerminalKey>d</TerminalKey>
                        </button>
                      ) : null}
                      {selectedRuntime ? (
                        <button
                          type="button"
                          className="border border-danger px-2 py-1 text-danger hover:bg-surface-primary/5"
                          onClick={() =>
                            setCancelTarget(selectedRuntime)
                          }
                        >
                          cancel <TerminalKey>x</TerminalKey>
                        </button>
                      ) : null}
                      {integratable ? (
                        <button
                          type="button"
                          className="border border-success px-2 py-1 text-success hover:bg-surface-primary/5"
                          onClick={() =>
                            runViewAction(
                              onIntegrate?.(selectedTask),
                            )
                          }
                        >
                          integrate
                        </button>
                      ) : null}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-text-inverted/40 sm:grid-cols-2">
                    <span className="truncate">
                      source · {selectedTask.source}
                    </span>
                    <span className="truncate">
                      deps ·{" "}
                      {selectedTask.dependencies.length
                        ? selectedTask.dependencies.join(", ")
                        : "none"}
                    </span>
                  </div>
                  {selectedTask.readinessReasons.length ? (
                    <div className="mt-2 text-warning">
                      ! {selectedTask.readinessReasons.join(" · ")}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {snapshot.events.length ? (
                <div className="mt-3 border border-text-inverted/15">
                  <div className="flex items-center justify-between border-b border-text-inverted/15 px-2 py-1.5 text-[9px] tracking-[0.1em] text-text-inverted/45">
                    <span>EVENT LOG</span>
                    <span>
                      latest {Math.min(snapshot.events.length, 8)}
                    </span>
                  </div>
                  {[...snapshot.events]
                    .slice(-8)
                    .reverse()
                    .map((event) => (
                      <div
                        key={event.id}
                        className="grid grid-cols-[66px_72px_150px_minmax(0,1fr)] gap-2 border-b border-text-inverted/10 px-2 py-1.5 text-[9px] last:border-b-0"
                      >
                        <time className="text-text-inverted/30">
                          {event.timestamp}
                        </time>
                        <span className="truncate text-info">
                          {event.taskId ?? "—"}
                        </span>
                        <strong className="truncate font-medium text-text-inverted/65">
                          {event.kind}
                        </strong>
                        <span className="truncate text-text-inverted/35">
                          {event.message}
                        </span>
                      </div>
                    ))}
                </div>
              ) : null}
            </div>

            <footer className="flex flex-wrap gap-x-3 gap-y-1 border-t border-text-inverted/15 px-4 py-2 text-[9px] text-text-inverted/40 sm:px-5">
              <span>
                <TerminalKey>j</TerminalKey>
                <TerminalKey>k</TerminalKey> project
              </span>
              <span>
                <TerminalKey>tab</TerminalKey> task
              </span>
              <span>
                <TerminalKey>d</TerminalKey> dispatch
              </span>
              <span>
                <TerminalKey>x</TerminalKey> cancel
              </span>
              <span>
                <TerminalKey>n</TerminalKey> project
              </span>
              <span>
                <TerminalKey>/</TerminalKey> commands
              </span>
              <span>
                <TerminalKey>r</TerminalKey> refresh
              </span>
              <span>
                <TerminalKey>esc</TerminalKey> close
              </span>
            </footer>
          </section>

          <aside
            className="flex h-[38vh] min-h-[240px] flex-col border-t border-text-inverted/15 xl:h-auto xl:min-h-0 xl:border-l xl:border-t-0"
            aria-label="Terminal Main Thread"
          >
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-text-inverted/15 px-3 text-[9px]">
              <strong className="tracking-[0.12em]">MAIN THREAD</strong>
              <span className="text-text-inverted/30">·</span>
              <span className="text-info">
                {snapshot.mainThread?.adapter ?? "not opened"}
              </span>
              <span className="text-text-inverted/30">·</span>
              <span
                className={terminalTone(
                  snapshot.mainThread?.status ?? "idle",
                )}
              >
                {snapshot.mainThread?.status ?? "ready"}
              </span>
            </div>

            <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {snapshot.messages.length ? (
                snapshot.messages.map((message) => (
                  <div
                    key={message.id}
                    className="mb-3 border-l border-text-inverted/15 pl-2 text-[10px]"
                  >
                    <div className="flex items-center gap-2 text-[9px] text-text-inverted/35">
                      <span
                        className={
                          message.author === "operator"
                            ? "text-primary"
                            : "text-info"
                        }
                      >
                        {message.author === "operator"
                          ? "operator"
                          : message.kind === "builder-result"
                            ? "builder result"
                            : "mira"}
                      </span>
                      <time>{message.createdAt}</time>
                    </div>
                    {message.kind === "builder-result" &&
                    message.handoff ? (
                      <div className="mt-1 flex flex-wrap gap-x-2 text-[9px]">
                        <span className="text-text-inverted/40">
                          {message.handoff.adapterId}
                        </span>
                        <span
                          className={terminalTone(
                            message.handoff.dispatchStatus,
                          )}
                        >
                          dispatch {message.handoff.dispatchStatus}
                        </span>
                        <span
                          className={terminalTone(
                            message.handoff.taskStatus,
                          )}
                        >
                          task {message.handoff.taskStatus}
                        </span>
                      </div>
                    ) : null}
                    <p className="mt-1 whitespace-pre-wrap break-words leading-5 text-text-inverted/70">
                      {message.body}
                    </p>
                  </div>
                ))
              ) : (
                <div className="border-l-2 border-primary pl-3 text-[10px] leading-5 text-text-inverted/40">
                  <span className="text-primary">›</span> Open the durable
                  Main Thread by sending the first message.
                </div>
              )}
            </div>

            <div className="border-t border-text-inverted/15 p-2">
              <textarea
                aria-label="Terminal Main Thread message"
                value={messageText}
                disabled={busy}
                onChange={(event) =>
                  setMessageText(event.target.value)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.ctrlKey || event.metaKey)
                  ) {
                    event.preventDefault();
                    void submitMessage();
                  }
                }}
                rows={3}
                placeholder="Message the Main Thread… · Ctrl/⌘+Enter"
                className="w-full resize-none border border-text-inverted/15 bg-transparent px-2 py-2 text-[10px] leading-5 text-text-inverted outline-none placeholder:text-text-inverted/25 focus:border-primary disabled:opacity-50"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[9px] text-text-inverted/30">
                  Main Thread ≠ Builder
                </span>
                <button
                  type="button"
                  disabled={busy || !messageText.trim()}
                  onClick={() => void submitMessage()}
                  className="flex items-center gap-1 border border-primary px-2 py-1 text-[9px] text-primary disabled:opacity-40"
                >
                  <Send className="h-3 w-3" />
                  send ^↵
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <ForgeDispatchModal
        open={dispatchOpen}
        busy={busy}
        task={selectedTask}
        builderChoice={builderChoice}
        builderChoices={snapshot.builderChoices}
        onBuilderChange={setBuilderChoice}
        onClose={() => setDispatchOpen(false)}
        onDispatch={async (task, builder) => {
          if (!onDispatch) return;
          await onDispatch(task, builder);
        }}
      />

      <ForgeRegisterProjectModal
        open={registerOpen}
        busy={busy}
        onClose={() => setRegisterOpen(false)}
        onSubmit={async (values) => {
          if (!onRegisterProject) return;
          await onRegisterProject(values);
        }}
      />

      <Modal
        open={Boolean(cancelTarget)}
        title="Cancel Builder"
        onClose={() => setCancelTarget(null)}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setCancelTarget(null)}
            >
              Keep running
            </Button>
            <Button
              variant="danger"
              disabled={busy || !cancelTarget}
              onClick={() => {
                if (!cancelTarget || !onCancel) return;
                void Promise.resolve(onCancel(cancelTarget))
                  .then(() => setCancelTarget(null))
                  .catch(() => undefined);
              }}
            >
              Cancel Builder
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          {cancelTarget
            ? "Cancel " +
              cancelTarget.builder +
              " on " +
              cancelTarget.taskId +
              "?"
            : "No active Builder selected."}
        </p>
      </Modal>

      {commandOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-ink/80 px-4 pt-[12vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Terminal command palette"
        >
          <div className="w-full max-w-md border border-text-inverted/25 bg-ink p-2 shadow-shadow-lg">
            <div className="flex items-center justify-between border-b border-text-inverted/15 px-2 py-2 text-[9px] tracking-[0.12em] text-text-inverted/45">
              <span>COMMANDS</span>
              <span>
                <TerminalKey>q</TerminalKey> /{" "}
                <TerminalKey>esc</TerminalKey>
              </span>
            </div>
            <div className="py-1 text-[10px]">
              {[
                {
                  key: "n",
                  label: "register project",
                  disabled: false,
                  action: () => {
                    setCommandOpen(false);
                    setRegisterOpen(true);
                  },
                },
                {
                  key: "d",
                  label: "dispatch selected task",
                  disabled: !selectedTask,
                  action: () => {
                    setCommandOpen(false);
                    if (selectedTask) setDispatchOpen(true);
                  },
                },
                {
                  key: "x",
                  label: "cancel active Builder",
                  disabled: !selectedRuntime,
                  action: () => {
                    setCommandOpen(false);
                    if (selectedRuntime)
                      setCancelTarget(selectedRuntime);
                  },
                },
                {
                  key: "r",
                  label: "refresh state",
                  disabled: false,
                  action: () => {
                    setCommandOpen(false);
                    runViewAction(onRefresh?.());
                  },
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={item.disabled}
                  onClick={item.action}
                  className="flex w-full items-center gap-3 px-2 py-2 text-left text-text-inverted/65 hover:bg-surface-primary/5 hover:text-text-inverted disabled:opacity-30"
                >
                  <TerminalKey>{item.key}</TerminalKey>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ForgeTerminalWorkspace;
