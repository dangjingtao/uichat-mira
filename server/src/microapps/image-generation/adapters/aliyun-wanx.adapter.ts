import type {
  ImageGenerationAdapterRunResult,
  ImageGenerationAdapterStartInput,
} from "../core/types.js";
import {
  asJsonObject,
  createFetchAdapterContext,
  ensurePrompt,
  expectOk,
  extractRemoteImageCandidates,
  joinUrl,
  jsonStringify,
  normalizeAsyncStatus,
  readJsonResponse,
} from "./shared.js";
import type { AdapterFactoryOptions, ProviderAdapter } from "./types.js";
import type { JsonObject } from "./types.js";

type AliyunWanxAdapterConfig = {
  apiKey: string;
  baseUrl: string;
  defaultModel?: string;
  timeoutMs?: number;
} & AdapterFactoryOptions;

type AliyunTaskPayload = {
  output?: {
    task_id?: string;
    task_status?: string;
    choices?: Array<{
      message?: {
        content?: Array<{
          image?: string;
          type?: string;
        }>;
      };
    }>;
  };
  request_id?: string;
  code?: string;
  message?: string;
};

export function createAliyunWanxAdapter(
  config: AliyunWanxAdapterConfig,
): ProviderAdapter {
  const context = config.context ?? createFetchAdapterContext();

  return {
    providerId: "aliyun_wanx",
    executionKind: "async-job",
    async startGeneration(input) {
      const prompt = ensurePrompt("aliyun_wanx", input.request.prompt);
      const body = buildAliyunRequestBody(
        input,
        prompt,
        input.request.model ?? config.defaultModel ?? "wan2.6-image",
      );
      const httpRequest = {
        url: joinUrl(config.baseUrl, "/services/aigc/image-generation/generation"),
        method: "POST" as const,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
        body: jsonStringify(body),
        timeoutMs: config.timeoutMs,
      };
      const response = await context.http(httpRequest);
      await expectOk(response, httpRequest);
      const payload = await readJsonResponse<AliyunTaskPayload>(response);
      return {
        status: normalizeAsyncStatus(payload.output?.task_status),
        providerJobId: payload.output?.task_id,
        artifacts: [],
        error:
          payload.code && payload.message
            ? {
                code: payload.code,
                message: payload.message,
                retryable: false,
              }
            : undefined,
        meta: {
          remoteStatus: payload.output?.task_status,
          rawResponse: payload,
        },
      };
    },
    async getGeneration({ job }) {
      const httpRequest = {
        url: joinUrl(config.baseUrl, `/tasks/${job.providerJobId}`),
        method: "GET" as const,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        timeoutMs: config.timeoutMs,
      };
      const response = await context.http(httpRequest);
      await expectOk(response, httpRequest);
      const payload = await readJsonResponse<AliyunTaskPayload>(response);
      return {
        status: normalizeAsyncStatus(payload.output?.task_status),
        providerJobId: payload.output?.task_id ?? job.providerJobId,
        artifacts: extractAliyunArtifacts(payload),
        error:
          payload.code && payload.message
            ? {
                code: payload.code,
                message: payload.message,
                retryable: false,
              }
            : undefined,
        meta: {
          remoteStatus: payload.output?.task_status,
          rawResponse: payload,
        },
      };
    },
  };
}

function buildAliyunRequestBody(
  input: ImageGenerationAdapterStartInput,
  prompt: string,
  model: string,
): Record<string, unknown> {
  const providerParams = input.request.providerParams ?? {};
  const parameters = {
    size: input.request.size,
    n: input.request.count ?? 1,
    seed: input.request.seed,
    watermark: providerParams.watermark ?? false,
    prompt_extend: providerParams.prompt_extend ?? true,
    negative_prompt: input.request.negativePrompt,
    style: input.request.stylePreset,
    ...getProviderParameterOverrides(providerParams as JsonObject),
  };

  return {
    model,
    input: {
      messages: [
        {
          role: "user",
          content: [{ text: prompt }],
        },
      ],
    },
    parameters,
  };
}

function getProviderParameterOverrides(
  providerParams: JsonObject,
): Record<string, unknown> {
  const overrides = asJsonObject(providerParams.parameters);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(overrides)) {
    result[key] = value;
  }
  return result;
}

function extractAliyunArtifacts(payload: AliyunTaskPayload) {
  const urls =
    payload.output?.choices
      ?.flatMap((choice) => choice.message?.content ?? [])
      .map((item) => item.image) ?? [];
  return extractRemoteImageCandidates(urls);
}
