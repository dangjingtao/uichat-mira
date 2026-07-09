import fs from "node:fs/promises";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { success } from "@/utils/index.js";
import { badRequest, notFound, routeHandler } from "@/utils/route-errors.js";
import type {
  GptSovitsSynthesisRequest,
  TtsProviderId,
  TtsService,
  TtsSynthesisRequest,
} from "@/microapps/tts/index.js";

type TtsRouteOptions = {
  ttsService: TtsService;
};

const ttsRoutes: FastifyPluginAsync<TtsRouteOptions> = async (app, options) => {
  const { ttsService } = options;

  const readGptSovitsMultipartRequest = async (request: FastifyRequest) => {
    const fields: Record<string, string> = {};
    let upload:
      | {
          buffer: Buffer;
          fileName: string;
          mimeType: string;
        }
      | undefined;

    for await (const part of request.parts()) {
      if (part.type === "file") {
        if (part.fieldname !== "refAudioFile") {
          continue;
        }
        upload = {
          buffer: await part.toBuffer(),
          fileName: part.filename,
          mimeType: part.mimetype || "application/octet-stream",
        };
        continue;
      }

      fields[part.fieldname] = String(part.value ?? "");
    }

    if (!upload) {
      throw badRequest("请上传参考音频文件");
    }
    const lowerFileName = upload.fileName.trim().toLowerCase();
    if (!lowerFileName.endsWith(".wav")) {
      throw badRequest("参考音频文件必须是 wav");
    }
    if (upload.mimeType && upload.mimeType !== "audio/wav" && upload.mimeType !== "audio/x-wav") {
      throw badRequest("参考音频文件必须是 wav");
    }

    const body: GptSovitsSynthesisRequest = {
      text: fields.text ?? "",
      refAudioPath: "",
      promptText: fields.promptText ?? "",
      promptLanguage: fields.promptLanguage ?? "",
      textLanguage: fields.textLanguage ?? "",
      gptModel: fields.gptModel ?? "",
      sovitsModel: fields.sovitsModel ?? "",
      cutMethod: fields.cutMethod ?? "",
      sampleSteps: Number(fields.sampleSteps ?? 0),
      speed: Number(fields.speed ?? 0),
      pauseSecond: Number(fields.pauseSecond ?? 0),
      temperature: Number(fields.temperature ?? 0),
      topK: Number(fields.topK ?? 0),
      topP: Number(fields.topP ?? 0),
    };

    return { body, upload };
  };

  app.get(
    "/microapps/tts/overview",
    routeHandler("Failed to load TTS overview", async () =>
      success(await ttsService.getOverview())),
  );

  app.put(
    "/microapps/tts/providers/:providerId",
    routeHandler("Failed to update TTS provider config", async (request) => {
      const params = request.params as { providerId: TtsProviderId };
      const body = request.body as {
        enabled?: boolean;
        displayName?: string;
        config?: Record<string, unknown>;
      };
      const provider = ttsService.updateProvider(params.providerId, body);
      return success({ provider }, "TTS provider config updated");
    }),
  );

  app.get(
    "/microapps/tts/voices",
    routeHandler("Failed to list TTS voices", async (request) => {
      const query = request.query as { providerId?: TtsProviderId };
      if (!query.providerId) {
        throw badRequest("providerId is required");
      }
      return success({
        voices: await ttsService.listVoices(query.providerId),
      });
    }),
  );

  app.post(
    "/microapps/tts/syntheses",
    routeHandler("Failed to create TTS synthesis", async (request) => {
      const body = request.body as TtsSynthesisRequest;
      const job = await ttsService.synthesize(body);
      return success({ job }, "TTS synthesis created");
    }),
  );

  app.get(
    "/microapps/tts/gpt-sovits/catalog",
    routeHandler("Failed to load GPT-SoVITS catalog", async () =>
      success({
        catalog: await ttsService.getGptSovitsCatalog(),
      }),
    ),
  );

  app.post(
    "/microapps/tts/gpt-sovits/syntheses",
    routeHandler("Failed to create GPT-SoVITS synthesis", async (request) => {
      let body: GptSovitsSynthesisRequest;
      let upload:
        | {
            buffer: Buffer;
            fileName: string;
            mimeType: string;
          }
        | undefined;

      if (request.isMultipart()) {
        const multipart = await readGptSovitsMultipartRequest(request);
        body = multipart.body;
        upload = multipart.upload;
      } else {
        body = request.body as GptSovitsSynthesisRequest;
      }

      const job = await ttsService.synthesizeGptSovits(body, upload);
      return success({ job }, "GPT-SoVITS synthesis created");
    }),
  );

  app.get(
    "/microapps/tts/syntheses/:id",
    routeHandler("Failed to load TTS synthesis", async (request) => {
      const params = request.params as { id: string };
      const job = ttsService.getSynthesis(params.id);
      if (!job) {
        throw notFound(`TTS synthesis job not found: ${params.id}`);
      }
      return success({ job });
    }),
  );

  app.get(
    "/microapps/tts/syntheses/:id/audio",
    routeHandler("Failed to load TTS synthesis audio", async (request, reply) => {
      const params = request.params as { id: string };
      const job = ttsService.getSynthesis(params.id);
      if (!job) {
        throw notFound(`TTS synthesis job not found: ${params.id}`);
      }
      if (!job.outputPath) {
        throw notFound(`TTS synthesis audio not found: ${params.id}`);
      }

      const bytes = await fs.readFile(job.outputPath);
      reply.header("Cache-Control", "no-store");
      reply.type(job.mimeType || "audio/wav");
      return reply.send(bytes);
    }),
  );
};

export default ttsRoutes;
