import { comfyUiStudioRepository, type ComfyUiConnectionRecord, type ComfyUiFlowRecord } from "@/db/repositories/comfyui-studio.repository.js";
import { createFetchAdapterContext, expectOk, joinUrl } from "./adapters/shared.js";

export type ComfyUiConnectionStatus =
  | "unconfigured"
  | "unverified"
  | "connectable"
  | "failed";

export type ComfyUiNodeMapping = {
  promptPath: string;
  seedPath: string;
  widthPath: string;
  heightPath: string;
  outputNodeId: string;
  previewNodeId: string;
};

export type ComfyUiFlowSource = "template" | "upload" | "manual";

export type ComfyUiConnection = ComfyUiConnectionRecord;
export type ComfyUiFlow = ComfyUiFlowRecord;

export class ComfyUiStudioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComfyUiStudioValidationError";
  }
}

export class ComfyUiStudioNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComfyUiStudioNotFoundError";
  }
}

const fetchContext = createFetchAdapterContext();

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

const normalizeClientId = (value: string | undefined) => value?.trim() ?? "";

const normalizeMapping = (mapping: Partial<ComfyUiNodeMapping> | undefined): ComfyUiNodeMapping => ({
  promptPath: mapping?.promptPath?.trim() ?? "",
  seedPath: mapping?.seedPath?.trim() ?? "",
  widthPath: mapping?.widthPath?.trim() ?? "",
  heightPath: mapping?.heightPath?.trim() ?? "",
  outputNodeId: mapping?.outputNodeId?.trim() ?? "",
  previewNodeId: mapping?.previewNodeId?.trim() ?? "",
});

const ensureWorkflowApiJsonString = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ComfyUiStudioValidationError("Workflow JSON is required.");
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ComfyUiStudioValidationError("Workflow JSON must be a JSON object.");
    }
  } catch (error) {
    if (error instanceof ComfyUiStudioValidationError) {
      throw error;
    }
    throw new ComfyUiStudioValidationError("Workflow JSON must be valid JSON.");
  }

  return trimmed;
};

const ensureConnection = (id: string) => {
  const connection = comfyUiStudioRepository.getConnectionById(id);
  if (!connection) {
    throw new ComfyUiStudioNotFoundError(`ComfyUI connection was not found: ${id}`);
  }
  return connection;
};

const ensureFlow = (id: string) => {
  const flow = comfyUiStudioRepository.getFlowById(id);
  if (!flow) {
    throw new ComfyUiStudioNotFoundError(`ComfyUI flow was not found: ${id}`);
  }
  return flow;
};

export const comfyUiStudioService = {
  listConnections(): ComfyUiConnection[] {
    return comfyUiStudioRepository.listConnections();
  },

  createConnection(input: { baseUrl: string; clientId?: string }): ComfyUiConnection {
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    if (!baseUrl) {
      throw new ComfyUiStudioValidationError("ComfyUI baseUrl is required.");
    }

    return comfyUiStudioRepository.createConnection({
      baseUrl,
      clientId: normalizeClientId(input.clientId) || null,
      status: "unverified",
      lastErrorJson: null,
      lastCheckedAt: null,
    });
  },

  updateConnection(
    id: string,
    input: { baseUrl: string; clientId?: string },
  ): ComfyUiConnection {
    const current = ensureConnection(id);
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    if (!baseUrl) {
      throw new ComfyUiStudioValidationError("ComfyUI baseUrl is required.");
    }

    return (
      comfyUiStudioRepository.updateConnection(id, {
        baseUrl,
        clientId: normalizeClientId(input.clientId) || null,
        status: current.baseUrl === baseUrl ? current.status : "unverified",
        lastErrorJson: current.baseUrl === baseUrl ? JSON.stringify(current.lastError) : null,
      }) ?? current
    );
  },

  async testConnection(id: string): Promise<ComfyUiConnection> {
    const connection = ensureConnection(id);
    const httpRequest = {
      url: joinUrl(connection.baseUrl, "/system_stats"),
      method: "GET" as const,
      timeoutMs: 5000,
    };

    try {
      const response = await fetchContext.http(httpRequest);
      await expectOk(response, httpRequest);
      return (
        comfyUiStudioRepository.updateConnection(id, {
          status: "connectable",
          lastErrorJson: null,
          lastCheckedAt: new Date().toISOString(),
        }) ?? connection
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "ComfyUI connection test failed.";
      return (
        comfyUiStudioRepository.updateConnection(id, {
          status: "failed",
          lastErrorJson: JSON.stringify({
            code: "COMFYUI_CONNECTION_TEST_FAILED",
            message,
          }),
          lastCheckedAt: new Date().toISOString(),
        }) ?? connection
      );
    }
  },

  listFlows(): ComfyUiFlow[] {
    return comfyUiStudioRepository.listFlows();
  },

  createFlow(input: {
    connectionId?: string | null;
    name: string;
    note?: string;
    source?: ComfyUiFlowSource;
    workflowApiJson: string;
    mapping?: Partial<ComfyUiNodeMapping>;
  }): ComfyUiFlow {
    const name = input.name.trim();
    if (!name) {
      throw new ComfyUiStudioValidationError("Flow name is required.");
    }

    if (input.connectionId) {
      ensureConnection(input.connectionId);
    }

    return comfyUiStudioRepository.createFlow({
      connectionId: input.connectionId ?? null,
      name,
      note: input.note?.trim() ?? "",
      source: input.source ?? "manual",
      workflowApiJson: ensureWorkflowApiJsonString(input.workflowApiJson),
      mappingJson: JSON.stringify(normalizeMapping(input.mapping)),
    });
  },

  updateFlow(
    id: string,
    input: {
      connectionId?: string | null;
      name: string;
      note?: string;
      source?: ComfyUiFlowSource;
      workflowApiJson: string;
      mapping?: Partial<ComfyUiNodeMapping>;
    },
  ): ComfyUiFlow {
    const current = ensureFlow(id);
    const name = input.name.trim();
    if (!name) {
      throw new ComfyUiStudioValidationError("Flow name is required.");
    }

    if (input.connectionId) {
      ensureConnection(input.connectionId);
    }

    return (
      comfyUiStudioRepository.updateFlow(id, {
        connectionId: input.connectionId ?? null,
        name,
        note: input.note?.trim() ?? "",
        source: input.source ?? current.source,
        workflowApiJson: ensureWorkflowApiJsonString(input.workflowApiJson),
        mappingJson: JSON.stringify(normalizeMapping(input.mapping)),
      }) ?? current
    );
  },
};
