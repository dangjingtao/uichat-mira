import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { message } from "@/shared/ui/Message";
import {
  executeMcpInvocationStream,
  getMcpInvocationTrace,
  getMcpTools,
  getMcpWebSearchConfig,
  getMcpWorkspaceSelection,
  saveMcpWebSearchConfig,
  selectMcpWorkspaceRoot,
  type McpArtifact,
  type McpInvocationEvent,
  type McpInvocationTrace,
  type McpToolDefinition,
} from "@/shared/api/tools";
import type {
  ToolDomainSummary,
  ToolWorkbenchDomain,
  WorkbenchToolDefinition,
} from "../types";
import {
  buildToolDraft,
  findPrimaryArtifact,
  getTerminalResultSummary,
  TOOL_DOMAIN_ORDER,
} from "../utils";
const WEB_SEARCH_DEFAULT_MAX_RESULTS = 4;
const WEB_SEARCH_MIN_RESULTS = 1;
const WEB_SEARCH_MAX_RESULTS = 10;
const WORKSPACE_REQUIRED_DOMAINS = new Set<ToolWorkbenchDomain>(["read", "edit", "terminal"]);

type WebSearchConfig = {
  apiKey: string;
  baseUrl: string;
  maxResults: number;
};

const defaultWebSearchConfig: WebSearchConfig = {
  apiKey: "",
  baseUrl: "",
  maxResults: WEB_SEARCH_DEFAULT_MAX_RESULTS,
};

const isWorkbenchDomain = (domain: McpToolDefinition["domain"]): domain is ToolWorkbenchDomain =>
  domain === "read" ||
  domain === "edit" ||
  domain === "web_search" ||
  domain === "terminal" ||
  domain === "browser_action";

const isWorkbenchTool = (tool: McpToolDefinition): tool is WorkbenchToolDefinition =>
  tool.source === "internal" && isWorkbenchDomain(tool.domain);

const normalizeWebSearchMaxResults = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return WEB_SEARCH_DEFAULT_MAX_RESULTS;
  }

  return Math.min(
    WEB_SEARCH_MAX_RESULTS,
    Math.max(WEB_SEARCH_MIN_RESULTS, Math.trunc(value)),
  );
};

export function useToolsWorkbench() {
  const { t } = useTranslation();
  const [activeDomain, setActiveDomain] = useState<ToolWorkbenchDomain>("read");
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [argsDraft, setArgsDraft] = useState("{}");
  const [tools, setTools] = useState<WorkbenchToolDefinition[]>([]);
  const [workspaceSelection, setWorkspaceSelection] = useState<Awaited<
    ReturnType<typeof getMcpWorkspaceSelection>
  > | null>(null);
  const [workspaceRootInput, setWorkspaceRootInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [isSelectingWorkspace, setIsSelectingWorkspace] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [webSearchConfig, setWebSearchConfig] = useState<WebSearchConfig>(defaultWebSearchConfig);
  const [events, setEvents] = useState<McpInvocationEvent[]>([]);
  const [trace, setTrace] = useState<McpInvocationTrace | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [artifacts, setArtifacts] = useState<McpArtifact[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<
    "idle" | "completed" | "failed" | "cancelled" | "awaiting_approval"
  >(
    "idle",
  );

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      setIsLoading(true);
      setIsWorkspaceLoading(true);
      try {
        const [toolList, workspace, persistedWebSearchConfig] = await Promise.all([
          getMcpTools(),
          getMcpWorkspaceSelection(),
          getMcpWebSearchConfig().catch(() => defaultWebSearchConfig),
        ]);
        if (disposed) {
          return;
        }

        const sortedTools = [...toolList]
          .filter(isWorkbenchTool)
          .sort((left, right) =>
          left.title.localeCompare(right.title, undefined, { numeric: true }),
          );
        setTools(sortedTools);
        setWorkspaceSelection(workspace);
        setWorkspaceRootInput(workspace.rootPath ?? "");
        setWebSearchConfig({
          apiKey: persistedWebSearchConfig.apiKey ?? "",
          baseUrl: persistedWebSearchConfig.baseUrl ?? "",
          maxResults: normalizeWebSearchMaxResults(persistedWebSearchConfig.maxResults),
        });

        const nextSelectedTool =
          sortedTools.find((tool) => tool.id === "read_open") ??
          sortedTools.find((tool) => tool.domain === "read") ??
          sortedTools[0] ??
          null;
        if (nextSelectedTool) {
          setSelectedToolId(nextSelectedTool.id);
          setActiveDomain(nextSelectedTool.domain);
          setArgsDraft(buildToolDraft(nextSelectedTool));
        }
      } catch (error) {
        if (!disposed) {
          message.error(
            error instanceof Error ? error.message : t("settings.tools.messages.loadFailed"),
          );
        }
      } finally {
        if (!disposed) {
          setIsLoading(false);
          setIsWorkspaceLoading(false);
        }
      }
    };

    void load();

    return () => {
      disposed = true;
    };
  }, [t]);

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.id === selectedToolId) ?? null,
    [selectedToolId, tools],
  );

  const groupedTools = useMemo(
    () =>
      TOOL_DOMAIN_ORDER.map((domain) => ({
        domain,
        tools: tools.filter((tool) => tool.domain === domain),
      })),
    [tools],
  );

  const domainSummaries = useMemo<ToolDomainSummary[]>(
    () =>
      groupedTools.map(({ domain, tools: domainTools }) => ({
        id: domain,
        count: domainTools.length,
        label: t(`settings.tools.domains.${domain}.label`),
        description: t(`settings.tools.domains.${domain}.description`),
      })),
    [groupedTools, t],
  );

  const filteredTools = useMemo(
    () => tools.filter((tool) => tool.domain === activeDomain),
    [activeDomain, tools],
  );

  const primaryArtifact = useMemo(() => findPrimaryArtifact(artifacts), [artifacts]);

  const resetRunState = () => {
    setEvents([]);
    setTrace(null);
    setResult(null);
    setArtifacts([]);
    setRunError(null);
    setRunStatus("idle");
  };

  const appendEvent = (event: McpInvocationEvent) => {
    setEvents((current) => [...current, event]);

    if (event.type === "invocation:artifact") {
      setArtifacts((current) => [...current, event.artifact]);
    }

    if (event.type === "invocation:result") {
      setResult(event.result);
    }

    if (event.type === "invocation:error") {
      setRunError(event.message);
      setRunStatus("failed");
    }

    if (event.type === "invocation:approval_required") {
      setRunError(event.message);
      setRunStatus("awaiting_approval");
    }

    if (event.type === "invocation:finish") {
      setRunStatus(event.status);
    }
  };

  const selectTool = (tool: WorkbenchToolDefinition) => {
    setSelectedToolId(tool.id);
    setActiveDomain(tool.domain);
    setArgsDraft(buildToolDraft(tool));
    resetRunState();
  };

  const terminalSummary = useMemo(() => getTerminalResultSummary(result), [result]);

  const updateWorkspaceRoot = async () => {
    const nextRootPath = workspaceRootInput.trim();
    if (!nextRootPath) {
      message.error(t("settings.tools.messages.workspaceRootRequired"));
      return;
    }

    setIsSelectingWorkspace(true);
    try {
      const nextSelection = await selectMcpWorkspaceRoot(nextRootPath);
      setWorkspaceSelection(nextSelection);
      setWorkspaceRootInput(nextSelection.rootPath ?? "");
      message.success(t("settings.tools.messages.workspaceUpdated"));
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : t("settings.tools.messages.workspaceUpdateFailed"),
      );
    } finally {
      setIsSelectingWorkspace(false);
    }
  };

  const runSelectedTool = async () => {
    if (!selectedTool) {
      message.error(t("settings.tools.messages.selectToolFirst"));
      return;
    }

    if (WORKSPACE_REQUIRED_DOMAINS.has(selectedTool.domain) && !workspaceSelection?.rootPath) {
      message.error(t("settings.tools.messages.workspaceRootRequired"));
      return;
    }

    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(argsDraft) as Record<string, unknown>;
    } catch {
      message.error(t("settings.tools.messages.invalidArgsJson"));
      return;
    }

    if (selectedTool.id === "web_search") {
      parsedArgs = {
        ...parsedArgs,
        maxResults: normalizeWebSearchMaxResults(webSearchConfig.maxResults),
        ...(webSearchConfig.apiKey.trim() ? { apiKey: webSearchConfig.apiKey.trim() } : {}),
        ...(webSearchConfig.baseUrl.trim() ? { baseUrl: webSearchConfig.baseUrl.trim() } : {}),
      };
    }

    resetRunState();
    setIsRunning(true);
    try {
      let invocationId = "";
      await executeMcpInvocationStream(
        {
          toolId: selectedTool.id,
          args: parsedArgs,
        },
        async (event) => {
          if (!invocationId && event.type === "invocation:start") {
            invocationId = event.invocationId;
          }
          appendEvent(event);
        },
      );

      if (invocationId) {
        const nextTrace = await getMcpInvocationTrace(invocationId);
        setTrace(nextTrace);
      }
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : t("settings.tools.messages.runFailed"),
      );
    } finally {
      setIsRunning(false);
    }
  };

  const selectDomain = (domain: ToolWorkbenchDomain) => {
    setActiveDomain(domain);
    const nextTool = tools.find((tool) => tool.domain === domain) ?? null;
    if (nextTool) {
      setSelectedToolId(nextTool.id);
      setArgsDraft(buildToolDraft(nextTool));
    } else {
      setSelectedToolId(null);
      setArgsDraft("{}");
    }
    resetRunState();
  };

  return {
    activeDomain,
    argsDraft,
    artifacts,
    domainSummaries,
    events,
    filteredTools,
    groupedTools,
    isLoading,
    isRunning,
    isSelectingWorkspace,
    isWorkspaceLoading,
    primaryArtifact,
    result,
    runError,
    runStatus,
    selectedTool,
    requiresWorkspace: WORKSPACE_REQUIRED_DOMAINS.has(activeDomain),
    terminalSummary,
    trace,
    tools,
    webSearchConfig,
    workspaceRootInput: WORKSPACE_REQUIRED_DOMAINS.has(activeDomain)
      ? workspaceRootInput
      : "",
    workspaceSelection: WORKSPACE_REQUIRED_DOMAINS.has(activeDomain)
      ? workspaceSelection
      : null,
    setArgsDraft,
    setWebSearchConfig,
    setWorkspaceRootInput,
    runSelectedTool,
    selectDomain,
    selectTool,
    updateWorkspaceRoot,
    saveWebSearchConfig: async () => {
      const saved = await saveMcpWebSearchConfig(webSearchConfig);
      setWebSearchConfig({
        apiKey: saved.apiKey,
        baseUrl: saved.baseUrl,
        maxResults: normalizeWebSearchMaxResults(saved.maxResults),
      });
      message.success(t("settings.tools.messages.webSearchConfigSaved"));
    },
  };
}
