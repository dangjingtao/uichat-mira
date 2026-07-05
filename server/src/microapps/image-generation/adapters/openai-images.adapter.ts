import type {
  ImageGenerationAdapterRunResult,
  ImageGenerationAdapterStartInput,
  ImageGenerationArtifactCandidate,
} from "../core/types.js";
import {
  createFetchAdapterContext,
  ensurePrompt,
  expectOk,
  extractRemoteImageCandidates,
  joinUrl,
  jsonStringify,
  readJsonResponse,
} from "./shared.js";
import type { AdapterFactoryOptions, ProviderAdapter } from "./types.js";

type OpenAiImagesAdapterConfig = {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  timeoutMs?: number;
} & AdapterFactoryOptions;

type OpenAiImagesResponse = {
  created?: number;
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
};

export function createOpenAiImagesAdapter(
  config: OpenAiImagesAdapterConfig,
): ProviderAdapter {
  const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  const context = config.context ?? createFetchAdapterContext();

  return {
    providerId: "openai_images",
    executionKind: "sync-http",
    async startGeneration(input) {
      return executeOpenAiRequest(config, baseUrl, input, context);
    },
  };
}

async function executeOpenAiRequest(
  config: OpenAiImagesAdapterConfig,
  baseUrl: string,
  input: ImageGenerationAdapterStartInput,
  context: NonNullable<OpenAiImagesAdapterConfig["context"]>,
): Promise<ImageGenerationAdapterRunResult> {
  const prompt = ensurePrompt("openai_images", input.request.prompt);
  const model = input.request.model ?? config.defaultModel ?? "gpt-image-1";
  const providerParams = input.request.providerParams ?? {};
  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    n: input.request.count ?? 1,
    size: input.request.size,
    user: providerParams.user,
    background: providerParams.background,
    output_format: providerParams.output_format,
    quality: providerParams.quality,
    moderation: providerParams.moderation,
  };

  if (!model.startsWith("gpt-image")) {
    requestBody.response_format = providerParams.response_format ?? "b64_json";
  }

  const httpRequest = {
    url: joinUrl(baseUrl, "/images/generations"),
    method: "POST" as const,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: jsonStringify(requestBody),
    timeoutMs: config.timeoutMs,
  };
  const response = await context.http(httpRequest);
  await expectOk(response, httpRequest);
  const payload = await readJsonResponse<OpenAiImagesResponse>(response);
  const images = payload.data ?? [];
  const artifacts: ImageGenerationArtifactCandidate[] = images.flatMap((item) => {
    if (item.b64_json) {
      return [
        {
          type: "image",
          mimeType: "image/png",
          source: "base64",
          base64Data: item.b64_json,
        },
      ];
    }
    return extractRemoteImageCandidates([item.url]);
  });

  if (artifacts.length === 0) {
    return {
      status: "failed",
      artifacts: [],
      error: {
        code: "OPENAI_IMAGES_EMPTY_RESULT",
        message: "OpenAI Images did not return any image artifacts.",
        retryable: false,
      },
      meta: {
        rawResponse: payload,
      },
    };
  }

  return {
    status: "succeeded",
    artifacts,
    meta: {
      revisedPrompts: images
        .map((item) => item.revised_prompt)
        .filter((value): value is string => Boolean(value)),
      rawResponse: payload,
    },
  };
}
