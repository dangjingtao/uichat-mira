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

export function createComfyUiLocalAdapter(
  config: ComfyUiLocalAdapterConfig,
): ProviderAdapter {
  const context = config.context ?? createFetchAdapterContext();

  return {
    providerId: "comfyui_local",
    executionKind: "workflow-runner",
    async startGeneration(input) {
      const workflowApiJson = ensureWorkflowApiJson(
        input.request.workflowApiJson as JsonObject | undefined,
      );
      const httpRequest = {
        url: joinUrl(config.baseUrl, "/prompt"),
        method: "POST" as const,
        headers: {
          "Content-Type": "application/json",
        },
        body: jsonStringify({
          prompt: workflowApiJson,
          client_id: config.clientId ?? input.job.id,
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
          rawResponse: payload,
        },
      };
    },
    async getGeneration({ job }) {
      const httpRequest = {
        url: joinUrl(config.baseUrl, `/history/${job.providerJobId}`),
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
      const artifacts = extractComfyArtifacts(config.baseUrl, historyItem);
      return {
        status,
        providerJobId: job.providerJobId,
        artifacts,
        meta: {
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
