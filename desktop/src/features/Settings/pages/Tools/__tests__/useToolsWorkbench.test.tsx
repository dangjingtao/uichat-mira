// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getMcpToolsMock = vi.fn();
const getMcpWorkspaceSelectionMock = vi.fn();
const getMcpWebSearchConfigMock = vi.fn();
const saveMcpWebSearchConfigMock = vi.fn();
const selectMcpWorkspaceRootMock = vi.fn();
const executeMcpInvocationStreamMock = vi.fn();
const getMcpInvocationTraceMock = vi.fn();
function stableT(key: string) {
  return key;
}

vi.mock("@/shared/api/tools", () => ({
  getMcpTools: () => getMcpToolsMock(),
  getMcpWorkspaceSelection: () => getMcpWorkspaceSelectionMock(),
  getMcpWebSearchConfig: () => getMcpWebSearchConfigMock(),
  saveMcpWebSearchConfig: (...args: unknown[]) => saveMcpWebSearchConfigMock(...args),
  selectMcpWorkspaceRoot: (...args: unknown[]) => selectMcpWorkspaceRootMock(...args),
  executeMcpInvocationStream: (...args: unknown[]) => executeMcpInvocationStreamMock(...args),
  getMcpInvocationTrace: (...args: unknown[]) => getMcpInvocationTraceMock(...args),
}));

vi.mock("@/shared/ui/Message", () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: stableT,
  }),
}));

async function importHook() {
  const { useToolsWorkbench } = await import("../hooks/useToolsWorkbench");
  return useToolsWorkbench;
}

describe("useToolsWorkbench", () => {
  beforeEach(() => {
    getMcpToolsMock.mockReset();
    getMcpWorkspaceSelectionMock.mockReset();
    getMcpWebSearchConfigMock.mockReset();
    saveMcpWebSearchConfigMock.mockReset();
    selectMcpWorkspaceRootMock.mockReset();
    executeMcpInvocationStreamMock.mockReset();
    getMcpInvocationTraceMock.mockReset();

    getMcpToolsMock.mockResolvedValue([
      {
        id: "web_search",
        title: "Web Search",
        description: "",
        domain: "web_search",
        source: "internal",
        mode: "sync",
        inputSchema: { type: "object" },
        tags: [],
        capabilities: {
          sideEffect: "network",
          requiresApproval: false,
          networkAccess: true,
        },
      },
    ]);
    getMcpWorkspaceSelectionMock.mockResolvedValue({
      rootPath: "D:/workspace/rag-demo",
      source: "selected",
    });
    getMcpWebSearchConfigMock.mockResolvedValue({
      apiKey: "saved-key",
      baseUrl: "http://localhost:8080",
      maxResults: 4,
    });
    saveMcpWebSearchConfigMock.mockImplementation(async (payload: unknown) => payload);
    getMcpInvocationTraceMock.mockResolvedValue({
      traceId: "trace-1",
      invocationId: "inv-1",
      toolId: "web_search",
      startedAt: "2026-01-01T00:00:00.000Z",
      spans: [],
    });
    executeMcpInvocationStreamMock.mockImplementation(async () => {});
  });

  it("persists only Tavily apiKey and SearXNG baseUrl while injecting default maxResults at runtime", async () => {
    const useToolsWorkbench = await importHook();
    const { result } = renderHook(() => useToolsWorkbench());

    await waitFor(() => {
      expect(result.current.tools).toHaveLength(1);
    }, { timeout: 3000 });

    expect(result.current.webSearchConfig).toEqual({
      apiKey: "saved-key",
      baseUrl: "http://localhost:8080",
      maxResults: 4,
    });

    await act(async () => {
      await result.current.saveWebSearchConfig();
    });

    expect(saveMcpWebSearchConfigMock).toHaveBeenCalledWith({
      apiKey: "saved-key",
      baseUrl: "http://localhost:8080",
      maxResults: 4,
    });

    act(() => {
      result.current.setArgsDraft(JSON.stringify({ query: "codex" }));
    });

    await act(async () => {
      await result.current.runSelectedTool();
    });

    expect(executeMcpInvocationStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        toolId: "web_search",
        args: expect.objectContaining({
          query: "codex",
          apiKey: "saved-key",
          baseUrl: "http://localhost:8080",
          maxResults: 4,
        }),
      }),
      expect.any(Function),
    );
  });

  it("does not require workspace when running web_search", async () => {
    getMcpWorkspaceSelectionMock.mockResolvedValueOnce({
      rootPath: null,
      source: "unset",
    });

    const useToolsWorkbench = await importHook();
    const { result } = renderHook(() => useToolsWorkbench());

    await waitFor(() => {
      expect(result.current.tools).toHaveLength(1);
    }, { timeout: 3000 });

    expect(result.current.requiresWorkspace).toBe(false);
    act(() => {
      result.current.selectTool(result.current.tools[0]!);
    });
    await act(async () => {
      await result.current.runSelectedTool();
    });

    expect(executeMcpInvocationStreamMock).toHaveBeenCalled();
    expect(executeMcpInvocationStreamMock.mock.calls[0]?.[0]).toMatchObject({
      toolId: "web_search",
    });
  });
});
