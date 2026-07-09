import fs from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import { success } from "@/utils/index.js";
import { badRequest, notFound, routeHandler } from "@/utils/route-errors.js";
import type {
  TtsProviderId,
  TtsService,
  TtsSynthesisRequest,
} from "@/microapps/tts/index.js";

type TtsRouteOptions = {
  ttsService: TtsService;
};

const ttsRoutes: FastifyPluginAsync<TtsRouteOptions> = async (app, options) => {
  const { ttsService } = options;

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
