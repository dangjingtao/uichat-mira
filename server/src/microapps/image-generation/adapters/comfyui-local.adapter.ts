import type {
  ImageGenerationAdapterRunResult,
  ImageGenerationArtifactCandidate,
} from "../core/types.js";
import {
  createFetchAdapterContext,
  createJobError,
  ensureWorkflowApiJson,
  expectOk,
  extractRemoteImageCandidates,
  joinUrl,
  jsonStringify,
  normalizeAsyncStatus,
  readJsonResponse,
} from "./shared.js";
import type { AdapterFactoryOptions, JsonObject, ProviderAdapter } from "./types.js";

type ComfyUiLocalAdapterConfig = {
  baseUrl: string;
  clientId?: string;
  timeoutMs?: number;
} & AdapterFactoryOptions;

type ComfySubmitPayload = {
  prompt_id?: string;
  number?: number;
  node_errors?: Record<string, unknown>;
};

type ComfyHistoryPayload = Record<
  string,
  {
    status?: {
      status_str?: string;
      completed?: boolean;
    };
    outputs?: Record<
      string,
      {
        images?: Array<{
          filename: string;
          subfolder?: string;
          type?: string;
        }>;
      }
    >;
  }
>;

const resolveRequestOverrides = (providerParams: Record<string, unknown> | undefined) => ({
  baseUrl:
    typeof providerParams?.baseUrl === "string" ? providerParams.baseUrl.trim() : "",
  clientId:
    typeof providerParams?.clientId === "string" ? providerParams.clientId.trim() : "",
});

export function createComfyUiLocalAdapter(
  config: ComfyUiLocalAdapterConfig,
): ProviderAdapter {
  const context = config.context ?? createFetchAdapterContext();

  return {
    providerId: "comfyui_local",
    executionKind: "workflow-runner",
    async startGeneration(input) {
      const overrides = resolveRequestOverrides(input.request.providerParams);
      const baseUrl = overrides.baseUrl || config.baseUrl;
      const clientId = overrides.clientId || config.clientId || input.job.id;
      const workflowApiJson = ensureWorkflowApiJson(
        input.request.workflowApiJson as JsonObject | undefined,
      );
      const httpRequest = {
        url: joinUrl(baseUrl, "/prompt"),
        method: "POST" as const,
        headers: {
          "Content-Type": "application/json",
        },
        body: jsonStringify({
          prompt: workflowApiJson,
          client_id: clientId,
        }),
        timeoutMs: config.timeoutMs,
      };
      const response = await context.http(httpRequest);
      await expectOk(response, httpRequest);
      const payload = await readJsonResponse<ComfySubmitPayload>(response);

      if (payload.node_errors && Object.keys(payload.node_errors).length > 0) {
        return {
          status: "failed",
          artifacts: [],
          error: createJobError(
            "COMFYUI_NODE_ERRORS",
            "ComfyUI rejected the workflow because one or more nodes failed validation.",
            { nodeErrors: payload.node_errors },
          ),
          meta: {
            rawResponse: payload,
          },
        };
      }

      if (!payload.prompt_id || typeof payload.prompt_id !== "string") {
        return {
          status: "failed",
          artifacts: [],
          error: createJobError(
            "COMFYUI_MISSING_PROMPT_ID",
            "ComfyUI did not return a valid prompt_id for the submitted workflow.",
          ),
          meta: {
            rawResponse: payload,
          },
        };
      }

      return {
        status: "queued",
        providerJobId: payload.prompt_id,
        artifacts: [],
        meta: {
          baseUrl,
          rawResponse: payload,
        },
      };
    },
    async getGeneration({ job }) {
      const baseUrl =
        typeof job.meta?.baseUrl === "string" && job.meta.baseUrl.trim()
          ? job.meta.baseUrl
          : config.baseUrl;
      const httpRequest = {
        url: joinUrl(baseUrl, `/history/${job.providerJobId}`),
        method: "GET" as const,
        timeoutMs: config.timeoutMs,
      };
      const response = await context.http(httpRequest);
      await expectOk(response, httpRequest);
      const payload = await readJsonResponse<ComfyHistoryPayload>(response);
      const historyItem = job.providerJobId ? payload[job.providerJobId] : undefined;
      const status = normalizeAsyncStatus(
        historyItem?.status?.completed
          ? "SUCCEEDED"
          : historyItem?.status?.status_str,
      );
      const artifacts = extractComfyArtifacts(baseUrl, historyItem);
      return {
        status,
        providerJobId: job.providerJobId,
        artifacts,
        meta: {
          baseUrl,
          remoteStatus: historyItem?.status?.status_str,
          rawResponse: payload,
        },
      };
    },
  };
}

function extractComfyArtifacts(
  baseUrl: string,
  historyItem:
    | {
        outputs?: Record<
          string,
          {
            images?: Array<{
              filename: string;
              subfolder?: string;
              type?: string;
            }>;
          }
        >;
      }
    | undefined,
): ImageGenerationArtifactCandidate[] {
  const urls: string[] = [];
  for (const output of Object.values(historyItem?.outputs ?? {})) {
    for (const image of output.images ?? []) {
      const viewUrl = new URL(joinUrl(baseUrl, "/view"));
      viewUrl.searchParams.set("filename", image.filename);
      if (image.subfolder) {
        viewUrl.searchParams.set("subfolder", image.subfolder);
      }
      if (image.type) {
        viewUrl.searchParams.set("type", image.type);
      }
      urls.push(viewUrl.toString());
    }
  }
  return extractRemoteImageCandidates(urls);
}
