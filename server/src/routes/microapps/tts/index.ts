import fs from "node:fs/promises";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { success } from "@/utils/index.js";
import { badRequest, internalError, notFound, routeHandler } from "@/utils/route-errors.js";
import type {
  ApiProviderCatalog,
  GptSovitsSynthesisRequest,
  TtsProviderId,
  TtsService,
  TtsSynthesisRequest,
} from "@/microapps/tts/index.js";
import { ttsRefAudiosRepository } from "@/db/repositories/tts-ref-audios.repository.js";

type TtsRouteOptions = {
  ttsService: TtsService;
};

const ttsRoutes: FastifyPluginAsync<TtsRouteOptions> = async (app, options) => {
  const { ttsService } = options;

  const toTtsRouteError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "TTS synthesis failed";

    if (
      message.includes("provider is unavailable") ||
      message.includes("modelPath is required") ||
      message.includes("Bundled Piper runtime was not found") ||
      message.includes("Synthesis text is required") ||
      message.includes("Use the GPT-SoVITS synthesis route") ||
      message.includes("ENOENT")
    ) {
      return badRequest(message, { cause: error });
    }

    return internalError(message, { cause: error });
  };

  const parseOptionalNumber = (value: string | undefined) => {
    if (value === undefined) {
      return Number.NaN;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return Number.NaN;
    }

    return Number(trimmed);
  };

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

    if (!upload && !fields.refAudioId) {
      throw badRequest("请上传参考音频文件");
    }
    if (upload) {
      const lowerFileName = upload.fileName.trim().toLowerCase();
      if (!lowerFileName.endsWith(".wav")) {
        throw badRequest("参考音频文件必须是 wav");
      }
      if (upload.mimeType && upload.mimeType !== "audio/wav" && upload.mimeType !== "audio/x-wav") {
        throw badRequest("参考音频文件必须是 wav");
      }
    }

    const body: GptSovitsSynthesisRequest = {
      text: fields.text ?? "",
      refAudioPath: "",
      refAudioId: fields.refAudioId,
      promptText: fields.promptText ?? "",
      promptLanguage: fields.promptLanguage ?? "",
      textLanguage: fields.textLanguage ?? "",
      gptModel: fields.gptModel ?? "",
      sovitsModel: fields.sovitsModel ?? "",
      cutMethod: fields.cutMethod ?? "",
      sampleSteps: parseOptionalNumber(fields.sampleSteps),
      speed: parseOptionalNumber(fields.speed),
      pauseSecond: parseOptionalNumber(fields.pauseSecond),
      temperature: parseOptionalNumber(fields.temperature),
      topK: parseOptionalNumber(fields.topK),
      topP: parseOptionalNumber(fields.topP),
    };

    return { body, upload };
  };

  app.get(
    "/microapps/tts/overview",
    routeHandler("Failed to load TTS overview", async () =>
      success(await ttsService.getOverview())),
  );

  app.post(
    "/microapps/tts/ref-audios",
    routeHandler("Failed to save TTS reference audio", async (request) => {
      if (!request.isMultipart()) {
        throw badRequest("参考音频必须通过 multipart/form-data 上传");
      }

      const { upload } = await readGptSovitsMultipartRequest(request);
      if (!upload) {
        throw badRequest("请上传参考音频文件");
      }

      const saved = ttsRefAudiosRepository.saveOrGet({
        buffer: upload.buffer,
        originalName: upload.fileName,
        mimeType: upload.mimeType,
      });
      return success({ refAudio: saved.summary }, "TTS reference audio saved");
    }),
  );

  app.get(
    "/microapps/tts/ref-audios/:id",
    routeHandler("Failed to load TTS reference audio", async (request, reply) => {
      const params = request.params as { id: string };
      const audio = ttsRefAudiosRepository.getById(params.id);
      if (!audio) {
        throw notFound(`TTS reference audio not found: ${params.id}`);
      }
      ttsRefAudiosRepository.touch(audio.id);
      reply.header("Cache-Control", "no-store");
      reply.type(audio.mimeType || "audio/wav");
      return reply.send(audio.audioBlob);
    }),
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
      let job;
      try {
        job = await ttsService.synthesize(body);
      } catch (error) {
        throw toTtsRouteError(error);
      }
      if (job.status === "failed") {
        throw badRequest(job.errorMessage || "TTS synthesis failed");
      }
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

  app.get(
    "/microapps/tts/api-provider/catalog",
    routeHandler("Failed to load API provider catalog", async () =>
      success({
        catalog: ttsService.getApiProviderCatalog() as ApiProviderCatalog,
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

      if (typeof request.isMultipart === "function" && request.isMultipart()) {
        const multipart = await readGptSovitsMultipartRequest(request);
        body = multipart.body;
        upload = multipart.upload;
      } else {
        body = request.body as GptSovitsSynthesisRequest;
      }

      const job = await ttsService.synthesizeGptSovits(body, upload);
      if (job.status === "failed") {
        throw badRequest(job.errorMessage || "GPT-SoVITS synthesis failed");
      }
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

      let bytes: Buffer;
      try {
        bytes = await fs.readFile(job.outputPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
          throw notFound(`TTS synthesis audio not found: ${params.id}`);
        }
        throw error;
      }
      reply.header("Cache-Control", "no-store");
      reply.type(job.mimeType || "audio/wav");
      return reply.send(bytes);
    }),
  );
};

export default ttsRoutes;
