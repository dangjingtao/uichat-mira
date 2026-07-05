import {
  createFetchAdapterContext,
  createTencentCloudAuthorization,
  ensurePrompt,
  expectOk,
  extractRemoteImageCandidates,
  jsonStringify,
  normalizeAsyncStatus,
  readJsonResponse,
} from "./shared.js";
import type {
  ImageGenerationAdapterRunResult,
  ImageGenerationAdapterStartInput,
} from "../core/types.js";
import type { AdapterFactoryOptions, ProviderAdapter } from "./types.js";

type TencentHunyuanAdapterConfig = {
  secretId: string;
  secretKey: string;
  region?: string;
  endpoint?: string;
  version?: string;
  timeoutMs?: number;
} & AdapterFactoryOptions;

type TencentSubmitPayload = {
  Response?: {
    JobId?: string;
    RequestId?: string;
    Error?: {
      Code?: string;
      Message?: string;
    };
  };
};

type TencentQueryPayload = {
  Response?: {
    JobStatusCode?: string;
    JobStatusMsg?: string;
    JobErrorCode?: string;
    JobErrorMsg?: string;
    ResultImage?: string[];
    RevisedPrompt?: string[];
    RequestId?: string;
  };
};

export function createTencentHunyuanAdapter(
  config: TencentHunyuanAdapterConfig,
): ProviderAdapter {
  const context = config.context ?? createFetchAdapterContext();

  return {
    providerId: "tencent_hunyuan",
    executionKind: "async-job",
    async startGeneration(input) {
      const prompt = ensurePrompt("tencent_hunyuan", input.request.prompt);
      const payload = {
        Prompt: prompt,
        NegativePrompt: input.request.negativePrompt,
        Style: input.request.stylePreset,
        Resolution: input.request.size?.replace("x", ":"),
        Num: input.request.count ?? 1,
        Seed: input.request.seed,
        ...(input.request.providerParams ?? {}),
      };
      const result = await callTencentCloud<TencentSubmitPayload>({
        action: "SubmitHunyuanImageJob",
        payload,
        context,
        config,
      });
      const response = result.Response;
      return {
        status: response?.JobId ? "queued" : "failed",
        providerJobId: response?.JobId,
        artifacts: [],
        error:
          response?.Error?.Code && response?.Error?.Message
            ? {
                code: response.Error.Code,
                message: response.Error.Message,
                retryable: false,
              }
            : undefined,
        meta: {
          rawResponse: result,
        },
      };
    },
    async getGeneration({ job }) {
      const result = await callTencentCloud<TencentQueryPayload>({
        action: "QueryHunyuanImageJob",
        payload: { JobId: job.providerJobId },
        context,
        config,
      });
      const response = result.Response;
      return {
        status: normalizeAsyncStatus(response?.JobStatusCode),
        providerJobId: job.providerJobId,
        artifacts: extractRemoteImageCandidates(response?.ResultImage ?? []),
        error:
          response?.JobErrorCode && response?.JobErrorMsg
            ? {
                code: response.JobErrorCode,
                message: response.JobErrorMsg,
                retryable: false,
              }
            : undefined,
        meta: {
          remoteStatus: response?.JobStatusMsg,
          revisedPrompts: response?.RevisedPrompt ?? [],
          rawResponse: result,
        },
      };
    },
  };
}

async function callTencentCloud<T>(params: {
  action: string;
  payload: Record<string, unknown>;
  context: NonNullable<TencentHunyuanAdapterConfig["context"]>;
  config: TencentHunyuanAdapterConfig;
}): Promise<T> {
  const endpoint = params.config.endpoint ?? "https://hunyuan.tencentcloudapi.com/";
  const host = new URL(endpoint).host;
  const timestamp = Math.floor(params.context.now().getTime() / 1000);
  const body = jsonStringify(params.payload);
  const authorization = createTencentCloudAuthorization({
    secretId: params.config.secretId,
    secretKey: params.config.secretKey,
    service: "hunyuan",
    host,
    action: params.action,
    version: params.config.version ?? "2023-09-01",
    region: params.config.region ?? "ap-guangzhou",
    timestamp,
    payload: body,
  });
  const httpRequest = {
    url: endpoint,
    method: "POST" as const,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json; charset=utf-8",
      Host: host,
      "X-TC-Action": params.action,
      "X-TC-Region": params.config.region ?? "ap-guangzhou",
      "X-TC-Timestamp": String(timestamp),
      "X-TC-Version": params.config.version ?? "2023-09-01",
    },
    body,
    timeoutMs: params.config.timeoutMs,
  };
  const response = await params.context.http(httpRequest);
  await expectOk(response, httpRequest);
  return readJsonResponse<T>(response);
}
