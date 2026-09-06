import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  FileClock,
  GitBranch,
  Hammer,
  ListTodo,
  Menu,
  PanelRight,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Square,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Drawer,
  IconButton,
  Modal,
  Select,
  TextInput,
} from "@/shared/ui";
import type {
  ForgeDispatchStatus,
  ForgeEvent,
  ForgeInspectorView,
  ForgeRegisterProjectValues,
  ForgeRuntimeRecord,
  ForgeRuntimeState,
  ForgeTask,
  ForgeWorkspaceSnapshot,
} from "../types";

interface ForgeWorkspaceProps {
  snapshot?: ForgeWorkspaceSnapshot | null;
  busy?: boolean;
  onBackToChat?: () => void;
  onRefresh?: () => void | Promise<void>;
  onSelectProject?: (projectId: string) => void | Promise<void>;
  onSelectTask?: (taskId: string) => void | Promise<void>;
  onRegisterProject?: (
    values: ForgeRegisterProjectValues,
  ) => void | Promise<void>;
  onSendMessage?: (value: string) => void | Promise<void>;
  onDispatch?: (
    task: ForgeTask,
    builder: "opencode" | "piagent" | "codex",
  ) => void | Promise<void>;
  onCancel?: (runtime: ForgeRuntimeRecord) => void | Promise<void>;
  onIntegrate?: (task: ForgeTask) => void | Promise<void>;
}

const runtimeLabel: Record<ForgeRuntimeState, string> = {
  waiting: "Waiting",
  building: "Building",
  reviewing: "Reviewing",
  fixing: "Fixing",
  waiting_integration: "Waiting integration",
  interrupted: "Interrupted",
  stale: "Stale",
  review_passed: "Review passed",
  integrated: "Integrated",
};

const dispatchLabel: Record<ForgeDispatchStatus, string> = {
  starting: "Starting",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  interrupted: "Interrupted",
};

const runtimeVariant = (state: ForgeRuntimeState) => {
  if (state === "review_passed" || state === "integrated") return "success";
  if (state === "building" || state === "fixing") return "primary";
  if (
    state === "reviewing" ||
    state === "waiting_integration" ||
    state === "stale"
  ) {
    return "warning";
  }
  if (state === "interrupted") return "danger";
  return "muted";
};

const dispatchVariant = (state: ForgeDispatchStatus) => {
  if (state === "completed") return "success";
  if (state === "starting" || state === "running") return "primary";
  if (state === "failed" || state === "interrupted") return "danger";
  return "muted";
};

const repositoryVariant = (state: string) => {
  const normalized = state.trim().toUpperCase();
  if (normalized === "PASS" || normalized === "INTEGRATED") return "success";
  if (normalized === "REVIEW") return "warning";
  if (normalized === "DOING") return "primary";
  return "muted";
};

const builderLabel = (builder: string) => {
  if (builder === "codex" || builder.includes("codex")) return "Codex";
  if (builder === "piagent" || builder.includes("piagent")) return "PiAgent";
  if (builder === "opencode" || builder.includes("opencode")) return "OpenCode";
  return builder;
};

function StatePair({ task }: { task: ForgeTask }) {
  const drift =
    task.repositoryLedgerState !== "UNKNOWN" &&
    task.repositoryLedgerState !== task.repositoryState;

  return (
    <div className="grid grid-cols-2 divide-x divide-border rounded-ui-panel border border-border bg-surface-primary">
      <div className="p-3">
        <div className="text-caption text-text-tertiary">Repository</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant={repositoryVariant(task.repositoryState)}>
            {task.repositoryState}
          </Badge>
          {drift ? (
            <span className="font-mono text-[10px] text-warning-text">
              ledger {task.repositoryLedgerState}
            </span>
          ) : null}
        </div>
      </div>
      <div className="p-3">
        <div className="text-caption text-text-tertiary">Runtime</div>
        <div className="mt-1.5">
          <Badge variant={runtimeVariant(task.runtimeState)}>
            {runtimeLabel[task.runtimeState]}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function TaskContext({
  task,
  taskSourceError,
  busy,
  onDispatch,
  onIntegrate,
  onClose,
}: {
  task: ForgeTask | null;
  taskSourceError: string | null;
  busy: boolean;
  onDispatch: () => void;
  onIntegrate: () => void;
  onClose?: () => void;
}) {
  if (!task) {
    return (
      <div className="h-full bg-surface-primary">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-caption text-text-tertiary">CURRENT TASK</span>
          {onClose ? (
            <IconButton ariaLabel="Close task context" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          ) : null}
        </div>
        <div className="p-4 text-sm text-text-tertiary">
          {taskSourceError
            ? "Repository Task Source 当前不可用。"
            : "No task selected"}
          {taskSourceError ? (
            <p className="mt-2 break-words font-mono text-[11px] leading-5">
              {taskSourceError}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const dispatchable =
    task.readiness === "ready" &&
    (task.runtimeState === "waiting" || task.runtimeState === "fixing");
  const integratable =
    task.runtimeState === "review_passed" &&
    Boolean(task.batchId) &&
    Boolean(task.currentSha) &&
    task.currentSha === task.reviewedSha;

  return (
    <div className="flex h-full flex-col bg-surface-primary">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-caption text-text-tertiary">CURRENT TASK</span>
        {onClose ? (
          <IconButton ariaLabel="Close task context" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        ) : null}
      </div>

      <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
        <div className="rounded-ui-panel border border-border bg-surface-secondary p-4">
          <div className="font-mono text-[11px] text-text-tertiary">{task.id}</div>
          <h2 className="mt-2 text-base font-medium">{task.title}</h2>
          <dl className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-text-tertiary">Task source</dt>
              <dd className="max-w-[190px] break-all font-mono text-right text-text-secondary">
                {task.source}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-tertiary">Dependencies</dt>
              <dd className="text-right text-text-secondary">
                {task.dependencies.length ? task.dependencies.join(", ") : "None"}
              </dd>
            </div>
            {task.currentSha ? (
              <div className="flex justify-between gap-3">
                <dt className="text-text-tertiary">Current SHA</dt>
                <dd className="font-mono text-right text-text-secondary">
                  {task.currentSha.slice(0, 10)}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-caption text-text-tertiary">STATE</div>
          <StatePair task={task} />
        </div>

        {task.warnings.length ? (
          <div className="mt-4 rounded-ui-panel border border-warning-border bg-warning-soft p-3 text-xs leading-5 text-warning-text">
            <div className="flex items-center gap-2 font-medium">
              <CircleAlert className="h-4 w-4" />
              Repository drift
            </div>
            <ul className="mt-1 space-y-1">
              {task.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {task.readiness === "blocked" ? (
          <div className="mt-4 rounded-ui-panel border border-danger-border bg-danger-soft p-3 text-xs leading-5 text-danger-text">
            <div className="flex items-center gap-2 font-medium">
              <CircleAlert className="h-4 w-4" />
              Dispatch unavailable
            </div>
            <p className="mt-1">
              {task.readinessReasons.length
                ? task.readinessReasons.join(" · ")
                : "Readiness checks have not passed."}
            </p>
          </div>
        ) : null}

        {task.runtimeState === "reviewing" ? (
          <div className="mt-4 rounded-ui-panel border border-border bg-surface-secondary p-3 text-xs leading-5 text-text-secondary">
            Builder 已完成当前施工阶段，Runtime 正等待独立 Review。Builder Result 不等于 Repository PASS。
          </div>
        ) : null}

        {task.runtimeState === "stale" ? (
          <div className="mt-4 rounded-ui-panel border border-warning-border bg-warning-soft p-3 text-xs leading-5 text-warning-text">
            当前 SHA 已变化，旧 Review 不能继续作为可执行 PASS。
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {dispatchable ? (
            <Button
              variant="primary"
              className="w-full"
              disabled={busy}
              onClick={onDispatch}
            >
              <Play className="h-4 w-4" />
              Dispatch Builder
            </Button>
          ) : null}
          {integratable ? (
            <Button
              variant="primary"
              className="w-full"
              disabled={busy}
              onClick={onIntegrate}
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm integrated
            </Button>
          ) : null}
          {!dispatchable && !integratable ? (
            <div className="py-2 text-center text-xs text-text-tertiary">
              当前状态没有可执行动作
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RuntimePanel({
  mode,
  runtimes,
  events,
  inspector,
  busy,
  onCancel,
  onClose,
}: {
  mode: "summary" | "inspector" | "events";
  runtimes: ForgeRuntimeRecord[];
  events: ForgeEvent[];
  inspector: ForgeInspectorView | null;
  busy: boolean;
  onCancel: (runtime: ForgeRuntimeRecord) => void;
  onClose: () => void;
}) {
  const title =
    mode === "summary"
      ? "Runtime Summary"
      : mode === "inspector"
        ? "Runtime Inspector"
        : "Event Log";

  return (
    <Drawer
      open
      onClose={onClose}
      width={420}
      header={<div className="text-sm font-semibold">{title}</div>}
    >
      {mode === "events" ? (
        <div className="space-y-1 font-mono text-xs">
          {events.length ? (
            events.map((event) => (
              <div
                key={event.id}
                className="grid grid-cols-[72px_100px_1fr] gap-2 border-b border-border/70 py-2 text-text-secondary"
              >
                <span className="text-text-tertiary">{event.timestamp}</span>
                <span className="truncate text-primary">{event.kind}</span>
                <span className="break-words">{event.message}</span>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-text-tertiary">No events</div>
          )}
        </div>
      ) : mode === "inspector" ? (
        <div className="space-y-4">
          {inspector ? (
            <>
              <div className="space-y-2 rounded-ui-panel border border-border bg-surface-secondary p-4 font-mono text-xs text-text-secondary">
                {inspector.detailLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
              {inspector.currentSha || inspector.reviewedSha ? (
                <div className="rounded-ui-panel border border-border bg-surface-primary p-4 text-xs">
                  <div className="text-caption text-text-tertiary">SHA BINDING</div>
                  <div className="mt-2 space-y-1 font-mono text-text-secondary">
                    <div>current · {inspector.currentSha ?? "—"}</div>
                    <div>reviewed · {inspector.reviewedSha ?? "—"}</div>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="py-8 text-center text-text-tertiary">
              Select a Task to inspect runtime state.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {runtimes.length ? (
            runtimes.map((runtime) => {
              const cancellable =
                runtime.state === "starting" || runtime.state === "running";
              return (
                <div key={runtime.id} className="border-b border-border/70 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{runtime.taskId}</div>
                      <div className="mt-1 text-xs text-text-tertiary">
                        {builderLabel(runtime.builder)}
                        {runtime.externalSessionId
                          ? " · " + runtime.externalSessionId
                          : ""}
                      </div>
                    </div>
                    <Badge variant={dispatchVariant(runtime.state)}>
                      {dispatchLabel[runtime.state]}
                    </Badge>
                  </div>
                  {runtime.summary ? (
                    <div className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-text-secondary">
                      {runtime.summary}
                    </div>
                  ) : null}
                  {cancellable ? (
                    <Button
                      className="mt-2"
                      size="xs"
                      variant="danger-ghost"
                      disabled={busy}
                      onClick={() => onCancel(runtime)}
                    >
                      <Square className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-text-tertiary">
              No runtime records
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

function BuilderResultCard({
  message,
}: {
  message: ForgeWorkspaceSnapshot["messages"][number];
}) {
  const handoff = message.handoff;
  if (!handoff) return null;
  const failed =
    handoff.dispatchStatus === "failed" ||
    handoff.dispatchStatus === "interrupted";

  return (
    <article className="mb-6 rounded-ui-panel border border-border bg-surface-primary">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Hammer className="h-4 w-4 shrink-0 text-text-tertiary" />
          <span className="truncate text-sm font-medium">
            Builder Result Handoff
          </span>
          <span className="font-mono text-[11px] text-text-tertiary">
            {handoff.taskId}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={failed ? "danger" : "success"}>
            {handoff.dispatchStatus}
          </Badge>
          <Badge variant="muted">{handoff.taskStatus}</Badge>
        </div>
      </div>
      <div className="p-4">
        <div className="text-xs text-text-tertiary">
          {builderLabel(handoff.adapterId)}
          {handoff.sessionStatus ? " · " + handoff.sessionStatus : ""}
          {" · "}
          {message.createdAt}
        </div>
        <p
          className={
            "mt-3 whitespace-pre-wrap text-sm leading-6 " +
            (failed ? "text-danger-text" : "text-text-secondary")
          }
        >
          {message.body}
        </p>
      </div>
    </article>
  );
}

function TaskList({
  tasks,
  selectedTaskId,
  onSelect,
}: {
  tasks: ForgeTask[];
  selectedTaskId?: string;
  onSelect: (taskId: string) => void;
}) {
  if (!tasks.length) {
    return (
      <div className="py-8 text-center text-sm text-text-tertiary">
        No repository tasks
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          aria-pressed={task.id === selectedTaskId}
          onClick={() => onSelect(task.id)}
          className={
            "w-full rounded-ui-control border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 " +
            (task.id === selectedTaskId
              ? "border-primary/20 bg-primary/5"
              : "border-transparent hover:bg-surface-secondary")
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[11px] text-text-tertiary">
                {task.id}
              </div>
              <div className="mt-1 truncate text-sm text-text-primary">
                {task.title}
              </div>
            </div>
            <Badge variant={runtimeVariant(task.runtimeState)}>
              {runtimeLabel[task.runtimeState]}
            </Badge>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-text-tertiary">
            <span>{task.repositoryState}</span>
            <span>·</span>
            <span>{task.readiness}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function RegisterModal({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: ForgeRegisterProjectValues) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [repositoryPath, setRepositoryPath] = useState("");
  const [branch, setBranch] = useState("main");
  const [taskLedger, setTaskLedger] = useState("");
  const [taskDir, setTaskDir] = useState("");

  const submit = async () => {
    await onSubmit({
      name: name.trim(),
      repositoryPath: repositoryPath.trim(),
      branch: branch.trim(),
      ...(taskLedger.trim() ? { taskLedger: taskLedger.trim() } : {}),
      ...(taskDir.trim() ? { taskDir: taskDir.trim() } : {}),
    });
    setName("");
    setRepositoryPath("");
    setBranch("main");
    setTaskLedger("");
    setTaskDir("");
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Register project"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={
              busy ||
              !name.trim() ||
              !repositoryPath.trim() ||
              !branch.trim()
            }
            onClick={() => void submit()}
          >
            Register project
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput label="Project name" value={name} onChange={setName} />
        <TextInput
          label="Local repository"
          value={repositoryPath}
          onChange={setRepositoryPath}
          placeholder="C:/work/project"
        />
        <TextInput
          label="Integration branch"
          value={branch}
          onChange={setBranch}
        />
        <div className="rounded-ui-panel border border-border bg-surface-secondary p-3">
          <div className="text-xs font-medium text-text-secondary">
            Repository Task Source
          </div>
          <p className="mt-1 text-xs leading-5 text-text-tertiary">
            Ledger 与 Task Directory 必须同时填写；留空时仅注册项目，不猜默认路径。
          </p>
          <div className="mt-3 space-y-3">
            <TextInput
              label="Task Ledger"
              value={taskLedger}
              onChange={setTaskLedger}
              placeholder="docs/project-control/project-control-ledger.md"
            />
            <TextInput
              label="Task Directory"
              value={taskDir}
              onChange={setTaskDir}
              placeholder="docs/project-control/tasks"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function ForgeWorkspace({
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
}: ForgeWorkspaceProps) {
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [taskListOpen, setTaskListOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [runtimePanel, setRuntimePanel] = useState<
    "summary" | "inspector" | "events" | null
  >(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [builderChoice, setBuilderChoice] =
    useState<"opencode" | "piagent" | "codex">("codex");

  const selectedTask = useMemo(
    () =>
      snapshot?.tasks.find(
        (task) => task.id === snapshot.selectedTaskId,
      ) ??
      snapshot?.tasks[0] ??
      null,
    [snapshot],
  );
  const activeRuntime = snapshot?.runtimes.find(
    (runtime) =>
      runtime.state === "starting" || runtime.state === "running",
  );

  useEffect(() => {
    const choices = snapshot?.builderChoices ?? [];
    if (!choices.length || choices.includes(builderChoice)) return;
    setBuilderChoice(choices.includes("codex") ? "codex" : choices[0]);
  }, [builderChoice, snapshot?.builderChoices]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      } else if (modifier && event.key.toLowerCase() === "p") {
        event.preventDefault();
        if (selectedTask) setDispatchOpen(true);
      } else if (modifier && event.key.toLowerCase() === "e") {
        event.preventDefault();
        setRuntimePanel("events");
      } else if (event.key === "Escape") {
        setCommandOpen(false);
        setDispatchOpen(false);
        setRegisterOpen(false);
        setRuntimePanel(null);
        setContextOpen(false);
        setTaskListOpen(false);
        setMobileRailOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedTask]);

  const submitMessage = async () => {
    const value = messageText.trim();
    if (!value || !onSendMessage) return;
    await onSendMessage(value);
    setMessageText("");
  };

  if (!snapshot || snapshot.projects.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-surface-secondary text-text-primary">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface-primary px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {onBackToChat ? (
              <IconButton ariaLabel="Back to chat" size="sm" onClick={onBackToChat}>
                <ArrowLeft className="h-4 w-4" />
              </IconButton>
            ) : null}
            <span className="grid h-7 w-7 place-items-center rounded-ui-control bg-ink text-xs font-semibold text-text-inverted">
              淬
            </span>
            <span className="font-serif text-lg">淬行</span>
            <span className="text-xs text-text-tertiary">
              Mira Desktop / Forge
            </span>
          </div>
          <Button size="sm" variant="primary" onClick={() => setRegisterOpen(true)}>
            <Plus className="h-4 w-4" />
            Register project
          </Button>
        </header>
        <main className="flex min-h-0 flex-1 items-center justify-center p-6">
          <section className="max-w-md text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <GitBranch className="h-5 w-5" />
            </div>
            <h1 className="mt-5 font-serif text-3xl">淬行</h1>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Register a local repository to open the Main Thread,
              repository tasks, Builder dispatch, and runtime review flow.
            </p>
            <Button
              className="mt-6"
              variant="primary"
              onClick={() => setRegisterOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Register project
            </Button>
          </section>
        </main>
        <RegisterModal
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
    <div className="flex h-full min-h-0 flex-col bg-surface-secondary text-text-primary">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-primary px-3 sm:px-5">
        <IconButton
          ariaLabel="Open project rail"
          className="md:hidden"
          onClick={() => setMobileRailOpen(true)}
        >
          <Menu className="h-4 w-4" />
        </IconButton>
        {onBackToChat ? (
          <IconButton
            ariaLabel="Back to chat"
            className="hidden md:inline-flex"
            size="sm"
            onClick={onBackToChat}
          >
            <ArrowLeft className="h-4 w-4" />
          </IconButton>
        ) : null}
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-ui-control bg-ink text-xs font-semibold text-text-inverted">
            淬
          </span>
          <span className="font-serif text-lg">淬行</span>
        </div>
        <span className="text-text-tertiary">/</span>
        <span className="min-w-0 truncate text-sm text-text-secondary">
          {snapshot.projects.find(
            (project) => project.id === snapshot.selectedProjectId,
          )?.name ?? "Workspace"}
        </span>

        <div className="ml-auto flex min-w-0 items-center gap-1">
          {activeRuntime ? (
            <Button
              size="sm"
              variant="ghost"
              className="hidden max-w-[240px] sm:inline-flex"
              onClick={() => setRuntimePanel("summary")}
            >
              <Hammer className="h-4 w-4" />
              <span className="truncate">
                {builderLabel(activeRuntime.builder)} · {activeRuntime.taskId}
              </span>
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRuntimePanel("summary")}
          >
            <Activity className="h-4 w-4" />
            {snapshot.activeRuntimeCount} active
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="hidden sm:inline-flex"
            onClick={() => setRuntimePanel("inspector")}
          >
            <CircleAlert className="h-4 w-4" />
            {snapshot.attentionCount} attention
          </Button>
          <IconButton
            ariaLabel="Command palette"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface-primary md:flex"
          aria-label="Project Rail"
        >
          <div className="flex h-12 items-center justify-between border-b border-border px-3">
            <span className="text-caption text-text-tertiary">PROJECTS</span>
            <IconButton
              ariaLabel="Register project"
              size="sm"
              onClick={() => setRegisterOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </IconButton>
          </div>
          <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
            {snapshot.projects.map((project) => (
              <button
                key={project.id}
                type="button"
                aria-pressed={project.id === snapshot.selectedProjectId}
                onClick={() => void onSelectProject?.(project.id)}
                className={
                  "mb-1 flex w-full items-center gap-2 rounded-ui-control px-2 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 " +
                  (project.id === snapshot.selectedProjectId
                    ? "bg-surface-secondary text-text-primary"
                    : "text-text-secondary hover:bg-surface-secondary")
                }
              >
                <span
                  className={
                    "h-2 w-2 rounded-full " +
                    (project.attentionCount
                      ? "bg-danger"
                      : project.activeRuntimeCount
                        ? "bg-primary"
                        : "bg-success")
                  }
                />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                {project.activeRuntimeCount ? (
                  <span className="font-mono text-[11px] text-primary">
                    {project.activeRuntimeCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border bg-surface-secondary px-4 py-3 sm:px-7">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-xl">Main Thread</h1>
                {snapshot.mainThread ? (
                  <Badge
                    variant={
                      snapshot.mainThread.status === "error"
                        ? "danger"
                        : snapshot.mainThread.status === "running"
                          ? "primary"
                          : "muted"
                    }
                  >
                    {snapshot.mainThread.adapter} · {snapshot.mainThread.status}
                  </Badge>
                ) : (
                  <Badge variant="muted">not opened</Badge>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-text-tertiary">
                {selectedTask
                  ? selectedTask.id + " · " + selectedTask.title
                  : snapshot.taskSourceError
                    ? "Task Source unavailable"
                    : "No task selected"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setTaskListOpen(true)}
              >
                <ListTodo className="h-4 w-4" />
                Tasks
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDispatchOpen(true)}
                disabled={!selectedTask}
              >
                <Play className="h-4 w-4" />
                Dispatch
              </Button>
              <IconButton
                ariaLabel="Open task context"
                className="xl:hidden"
                onClick={() => setContextOpen(true)}
              >
                <PanelRight className="h-4 w-4" />
              </IconButton>
            </div>
          </div>

          <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7">
            {snapshot.messages.map((item) =>
              item.kind === "builder-result" ? (
                <BuilderResultCard key={item.id} message={item} />
              ) : (
                <article key={item.id} className="mb-7 flex gap-3">
                  <div
                    className={
                      "grid h-8 w-8 shrink-0 place-items-center rounded-ui-control text-xs font-semibold " +
                      (item.author === "operator"
                        ? "bg-ink text-text-inverted"
                        : "bg-surface-soft text-text-primary")
                    }
                  >
                    {item.author === "operator" ? "你" : "M"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium">
                        {item.author === "operator" ? "Operator" : "Mira"}
                      </span>
                      <span className="text-text-tertiary">{item.createdAt}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-text-secondary">
                      {item.body}
                    </p>
                  </div>
                </article>
              ),
            )}
            {snapshot.messages.length === 0 ? (
              <div className="mx-auto max-w-md py-16 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-surface-primary text-text-tertiary">
                  <FileClock className="h-4 w-4" />
                </div>
                <div className="mt-4 text-sm font-medium text-text-primary">
                  Main Thread 还没有内容
                </div>
                <p className="mt-2 text-sm leading-6 text-text-tertiary">
                  在这里讨论项目判断、Task 取舍和 Builder 结果。第一次发送时会显式创建 Main Thread。
                </p>
              </div>
            ) : null}
          </div>

          <div className="border-t border-border bg-surface-secondary p-3 sm:p-5">
            <div className="rounded-ui-panel border border-border bg-surface-primary p-3 focus-within:border-primary">
              <textarea
                aria-label="Main Thread message"
                value={messageText}
                disabled={busy}
                onChange={(event) => setMessageText(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    (event.metaKey || event.ctrlKey) &&
                    event.key === "Enter"
                  ) {
                    event.preventDefault();
                    void submitMessage();
                  }
                }}
                placeholder="Continue the Main Thread…"
                className="min-h-[72px] w-full resize-none border-0 bg-transparent p-0 text-sm text-text-primary outline-none placeholder:text-text-tertiary disabled:opacity-60"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-text-tertiary">
                  <kbd className="rounded-ui-control border border-border px-1.5 py-0.5 font-mono">
                    ⌘↵
                  </kbd>{" "}
                  send
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy || !messageText.trim()}
                  onClick={() => void submitMessage()}
                >
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        </main>

        <aside className="hidden w-80 shrink-0 border-l border-border xl:flex">
          <TaskContext
            task={selectedTask}
            taskSourceError={snapshot.taskSourceError}
            busy={busy}
            onDispatch={() => setDispatchOpen(true)}
            onIntegrate={() => {
              if (selectedTask) void onIntegrate?.(selectedTask);
            }}
          />
        </aside>
      </div>

      <Drawer
        open={mobileRailOpen}
        onClose={() => setMobileRailOpen(false)}
        width={280}
        header={<div className="text-sm font-semibold">Projects</div>}
      >
        <div className="space-y-1">
          {snapshot.projects.map((project) => (
            <Button
              key={project.id}
              variant={
                project.id === snapshot.selectedProjectId
                  ? "secondary"
                  : "ghost"
              }
              className="w-full justify-start"
              onClick={() => {
                setMobileRailOpen(false);
                void onSelectProject?.(project.id);
              }}
            >
              {project.name}
            </Button>
          ))}
        </div>
      </Drawer>

      <Drawer
        open={taskListOpen}
        onClose={() => setTaskListOpen(false)}
        width={360}
        header={<div className="text-sm font-semibold">Repository Tasks</div>}
      >
        {snapshot.taskSourceError ? (
          <div className="mb-3 rounded-ui-panel border border-warning-border bg-warning-soft p-3 text-xs leading-5 text-warning-text">
            {snapshot.taskSourceError}
          </div>
        ) : null}
        <TaskList
          tasks={snapshot.tasks}
          selectedTaskId={snapshot.selectedTaskId}
          onSelect={(taskId) => {
            setTaskListOpen(false);
            void onSelectTask?.(taskId);
          }}
        />
      </Drawer>

      <Drawer
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        width={360}
        header={<div className="text-sm font-semibold">Current Task</div>}
      >
        <TaskContext
          task={selectedTask}
          taskSourceError={snapshot.taskSourceError}
          busy={busy}
          onDispatch={() => {
            setContextOpen(false);
            setDispatchOpen(true);
          }}
          onIntegrate={() => {
            setContextOpen(false);
            if (selectedTask) void onIntegrate?.(selectedTask);
          }}
        />
      </Drawer>

      {runtimePanel ? (
        <RuntimePanel
          mode={runtimePanel}
          runtimes={snapshot.runtimes}
          events={snapshot.events}
          inspector={snapshot.inspector}
          busy={busy}
          onCancel={(runtime) => void onCancel?.(runtime)}
          onClose={() => setRuntimePanel(null)}
        />
      ) : null}

      <Modal
        open={dispatchOpen}
        title="Dispatch Builder"
        onClose={() => setDispatchOpen(false)}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setDispatchOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                busy ||
                !selectedTask ||
                selectedTask.readiness !== "ready" ||
                !(
                  selectedTask.runtimeState === "waiting" ||
                  selectedTask.runtimeState === "fixing"
                )
              }
              onClick={() => {
                if (!selectedTask || !onDispatch) return;
                void Promise.resolve(
                  onDispatch(selectedTask, builderChoice),
                )
                  .then(() => setDispatchOpen(false))
                  .catch(() => undefined);
              }}
            >
              <Play className="h-4 w-4" />
              Dispatch Builder
            </Button>
          </>
        }
      >
        {selectedTask ? (
          <div className="space-y-4">
            <StatePair task={selectedTask} />
            <Select
              label="Builder"
              value={builderChoice}
              onChange={(value) =>
                setBuilderChoice(
                  value as "opencode" | "piagent" | "codex",
                )
              }
              options={snapshot.builderChoices.map((builder) => ({
                value: builder,
                label: builderLabel(builder),
              }))}
            />
            <div className="rounded-ui-panel border border-border bg-surface-secondary p-3 text-xs leading-5 text-text-secondary">
              Dispatch 是显式动作。淬行不会自动 fallback 到另一个 Builder，也不会自动 push / merge / deploy。
            </div>
            {selectedTask.readiness !== "ready" ? (
              <p className="text-sm text-danger-text">
                Dispatch is unavailable until backend readiness passes.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">No task selected.</p>
        )}
      </Modal>

      <RegisterModal
        open={registerOpen}
        busy={busy}
        onClose={() => setRegisterOpen(false)}
        onSubmit={async (values) => {
          if (!onRegisterProject) return;
          await onRegisterProject(values);
        }}
      />

      <Modal
        open={commandOpen}
        title="Command palette"
        onClose={() => setCommandOpen(false)}
        footer={
          <Button variant="ghost" onClick={() => setCommandOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              setCommandOpen(false);
              setTaskListOpen(true);
            }}
          >
            <ListTodo className="h-4 w-4" />
            Tasks
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            disabled={!selectedTask}
            onClick={() => {
              setCommandOpen(false);
              setDispatchOpen(true);
            }}
          >
            <Play className="h-4 w-4" />
            Dispatch current Task
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              setCommandOpen(false);
              setRuntimePanel("inspector");
            }}
          >
            <PanelRight className="h-4 w-4" />
            Runtime Inspector
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              setCommandOpen(false);
              setRuntimePanel("events");
            }}
          >
            <FileClock className="h-4 w-4" />
            Event Log
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              setCommandOpen(false);
              setRegisterOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Register project
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            disabled={busy}
            onClick={() => {
              setCommandOpen(false);
              void onRefresh?.();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default ForgeWorkspace;
