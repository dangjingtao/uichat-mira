import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAliyunWanxAdapter,
  createComfyUiLocalAdapter,
  createOpenAiImagesAdapter,
  createTencentHunyuanAdapter,
  type HttpRequest,
  type HttpResponse,
  type ImageGenerationAdapterContext,
} from "../adapters/index.js";
import { createImageGenerationService, createInMemoryImageGenerationJobStore } from "../core/service.js";
import type { ImageGenerationAdapterRegistry } from "../core/types.js";

function createJsonResponse(payload: unknown, status = 200): HttpResponse {
  return {
    status,
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    },
  };
}

function createMockContext(
  responder: (request: HttpRequest) => HttpResponse | Promise<HttpResponse>,
): ImageGenerationAdapterContext {
  return {
    now: () => new Date("2026-07-06T00:00:00.000Z"),
    http: vi.fn(responder),
  };
}

function createRegistry(adapters: Array<{ providerId: string }>) {
  return {
    getAdapter(providerId: string) {
      return adapters.find((item) => item.providerId === providerId) ?? null;
    },
  } satisfies ImageGenerationAdapterRegistry;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("image-generation adapters", () => {
  it("lets T101 service directly consume the OpenAI adapter contract", async () => {
    const context = createMockContext((request) => {
      expect(request.url).toBe("https://api.openai.com/v1/images/generations");
      const body = JSON.parse(request.body ?? "{}");
      expect(body.prompt).toBe("sunset city");
      return createJsonResponse({
        data: [{ b64_json: "ZmFrZS1pbWFnZS0x", revised_prompt: "revised one" }],
      });
    });
    const adapter = createOpenAiImagesAdapter({
      apiKey: "sk-test",
      context,
    });
    const service = createImageGenerationService({
      adapterRegistry: createRegistry([adapter]),
      artifactStore: {
        async materializeArtifacts({ artifacts }) {
          return artifacts.map((artifact, index) => ({
            id: `artifact-${index + 1}`,
            type: artifact.type,
            mimeType: artifact.mimeType,
            source: "local-file" as const,
            localPath: `.test-artifact/openai-${index + 1}.png`,
          }));
        },
      },
      jobStore: createInMemoryImageGenerationJobStore(),
      now: () => "2026-07-06T12:00:00.000Z",
      createId: () => "job-openai-1",
    });

    const job = await service.createGeneration({
      providerId: "openai_images",
      prompt: "sunset city",
    });

    expect(job.status).toBe("succeeded");
    expect(job.artifacts[0]?.source).toBe("local-file");
  });

  it("submits Aliyun Wanx as an async job and polls remote URLs through the core contract", async () => {
    const context = createMockContext((request) => {
      if (request.method === "POST") {
        expect(request.headers?.["X-DashScope-Async"]).toBe("enable");
        return createJsonResponse({
          output: {
            task_status: "PENDING",
            task_id: "wanx-job-1",
          },
        });
      }
      return createJsonResponse({
        output: {
          task_id: "wanx-job-1",
          task_status: "SUCCEEDED",
          choices: [
            {
              message: {
                content: [{ type: "image", image: "https://dashscope-result.example/1.png" }],
              },
            },
          ],
        },
      });
    });
    const adapter = createAliyunWanxAdapter({
      apiKey: "dashscope-key",
      baseUrl: "https://dashscope.aliyuncs.com/api/v1",
      context,
    });

    const queued = await adapter.startGeneration({
      job: {} as never,
      request: { providerId: "aliyun_wanx", prompt: "tomato" },
      requestSummary: {} as never,
    });
    expect(queued.status).toBe("queued");
    expect(queued.providerJobId).toBe("wanx-job-1");

    const polled = await adapter.getGeneration!({
      job: {
        providerJobId: "wanx-job-1",
      } as never,
    });
    expect(polled.status).toBe("succeeded");
    expect(polled.artifacts?.[0]).toEqual({
      type: "image",
      mimeType: "image/png",
      source: "remote-url",
      remoteUrl: "https://dashscope-result.example/1.png",
    });
  });

  it("builds Tencent Hunyuan requests and parses async query results through the core contract", async () => {
    const context = createMockContext((request) => {
      if (request.headers?.["X-TC-Action"] === "SubmitHunyuanImageJob") {
        const body = JSON.parse(request.body ?? "{}");
        expect(body.Prompt).toBe("bamboo path");
        expect(body.Resolution).toBe("1024:1024");
        return createJsonResponse({
          Response: {
            JobId: "hunyuan-job-1",
          },
        });
      }
      return createJsonResponse({
        Response: {
          JobStatusCode: "5",
          JobStatusMsg: "处理完成",
          ResultImage: ["https://cos.example/hunyuan.png"],
          RevisedPrompt: ["expanded prompt"],
        },
      });
    });
    const adapter = createTencentHunyuanAdapter({
      secretId: "sid",
      secretKey: "skey",
      context,
    });

    const queued = await adapter.startGeneration({
      job: {} as never,
      request: {
        providerId: "tencent_hunyuan",
        prompt: "bamboo path",
        size: "1024x1024",
      },
      requestSummary: {} as never,
    });
    expect(queued.status).toBe("queued");
    expect(queued.providerJobId).toBe("hunyuan-job-1");

    const polled = await adapter.getGeneration!({
      job: { providerJobId: "hunyuan-job-1" } as never,
    });
    expect(polled.status).toBe("succeeded");
    expect(polled.artifacts?.[0]?.remoteUrl).toBe("https://cos.example/hunyuan.png");
  });

  it("accepts ComfyUI workflow API JSON and converts history outputs to view URLs", async () => {
    const context = createMockContext((request) => {
      if (request.method === "POST") {
        const body = JSON.parse(request.body ?? "{}");
        expect(body.prompt["3"].class_type).toBe("SaveImage");
        expect(body.prompt_id).toBeUndefined();
        return createJsonResponse({
          prompt_id: "comfy-job-1",
        });
      }

      return createJsonResponse({
        "comfy-job-1": {
          status: {
            completed: true,
            status_str: "success",
          },
          outputs: {
            save: {
              images: [{ filename: "output.png", subfolder: "ComfyUI", type: "output" }],
            },
          },
        },
      });
    });
    const adapter = createComfyUiLocalAdapter({
      baseUrl: "http://127.0.0.1:8188",
      context,
    });

    const queued = await adapter.startGeneration({
      job: { id: "job-comfy-1" } as never,
      request: {
        providerId: "comfyui_local",
        workflowApiJson: {
          "3": {
            class_type: "SaveImage",
            inputs: {},
          },
        },
      },
      requestSummary: {} as never,
    });
    expect(queued.status).toBe("queued");
    expect(queued.providerJobId).toBe("comfy-job-1");

    const polled = await adapter.getGeneration!({
      job: { providerJobId: "comfy-job-1" } as never,
    });
    expect(polled.status).toBe("succeeded");
    expect(polled.artifacts?.[0]?.remoteUrl).toBe(
      "http://127.0.0.1:8188/view?filename=output.png&subfolder=ComfyUI&type=output",
    );
  });

  it("fails ComfyUI submissions when the server reports node_errors", async () => {
    const context = createMockContext(() =>
      createJsonResponse({
        node_errors: {
          "3": {
            errors: ["invalid input"],
          },
        },
      }),
    );
    const adapter = createComfyUiLocalAdapter({
      baseUrl: "http://127.0.0.1:8188",
      context,
    });

    const result = await adapter.startGeneration({
      job: { id: "job-comfy-invalid" } as never,
      request: {
        providerId: "comfyui_local",
        workflowApiJson: {
          "3": {
            class_type: "SaveImage",
            inputs: {},
          },
        },
      },
      requestSummary: {} as never,
    });

    expect(result.status).toBe("failed");
    expect(result.providerJobId).toBeUndefined();
    expect(result.error?.code).toBe("COMFYUI_NODE_ERRORS");
  });

  it("fails ComfyUI submissions when prompt_id is missing instead of faking a queued job", async () => {
    const context = createMockContext(() => createJsonResponse({ number: 1 }));
    const adapter = createComfyUiLocalAdapter({
      baseUrl: "http://127.0.0.1:8188",
      context,
    });

    const result = await adapter.startGeneration({
      job: { id: "job-comfy-missing-id" } as never,
      request: {
        providerId: "comfyui_local",
        workflowApiJson: {
          "3": {
            class_type: "SaveImage",
            inputs: {},
          },
        },
      },
      requestSummary: {} as never,
    });

    expect(result.status).toBe("failed");
    expect(result.providerJobId).toBeUndefined();
    expect(result.error?.code).toBe("COMFYUI_MISSING_PROMPT_ID");
  });
});
