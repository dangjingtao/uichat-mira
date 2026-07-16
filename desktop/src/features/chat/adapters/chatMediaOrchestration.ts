import type {
  ChatMessage,
  ChatSendLifecyclePolicy,
  ChatThread,
} from "@/shared/uchat/core";
import {
  attachChatMedia,
  getThreadById,
  updateChatMessageMetadata,
} from "@/shared/api/thread";
import {
  createGptSovitsSynthesis,
  createTtsSynthesis,
} from "@/shared/api/tts";
import {
  createImageGeneration,
  getImageGeneration,
} from "@/shared/api/imageGeneration";
import { listComfyUiConnections, listComfyUiFlows } from "@/shared/api/comfyuiStudio";
import { getMicroAppCapabilities } from "@/shared/api/microAppCapabilities";
import { getGptSovitsReferenceAudioId, type TtsProviderId } from "@/shared/api/tts";

type MediaSettings = {
  ttsEnabled?: unknown;
  imageEnabled?: unknown;
};

const notifyChatMediaUpdated = (threadId: string, messageId: string) => {
  globalThis.window?.dispatchEvent(new CustomEvent("uichat:chat-media-updated", {
    detail: { threadId, messageId },
  }));
};

export const shouldGenerateChatMedia = ({
  settings,
  roleId,
  knowledgeBaseId,
}: {
  settings: MediaSettings;
  roleId?: unknown;
  knowledgeBaseId?: unknown;
}) => ({
  tts: settings.ttsEnabled === true,
  image: settings.imageEnabled === true &&
    typeof roleId === "string" && !knowledgeBaseId,
});

const asSettings = (thread: ChatThread): MediaSettings => {
  const metadata = thread.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as MediaSettings)
    : {};
};

const assistantText = (message: ChatMessage) =>
  message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

const findCapability = (
  capabilities: Awaited<ReturnType<typeof getMicroAppCapabilities>>,
  capabilityCode: "tts" | "imageGeneration",
) => capabilities.find((item) => item.capabilityCode === capabilityCode && item.enabled);

const runTts = async (thread: ChatThread, message: ChatMessage, providerId: string) => {
  const text = assistantText(message);
  if (!text) return;
  const response = providerId === "gpt_sovits"
    ? await createGptSovitsSynthesis({
        text,
        refAudioId: await resolveGptReferenceAudioId(),
      })
    : await createTtsSynthesis({ providerId: providerId as Parameters<typeof createTtsSynthesis>[0]["providerId"], text });
  const job = response.job;
  if (job.status !== "succeeded" || !job.outputPath || !job.mimeType) {
    throw new Error("TTS did not produce a completed audio artifact.");
  }
  await attachChatMedia(thread.id, {
    messageId: message.id,
    taskId: job.id,
    mediaType: "audio",
    absolutePath: job.outputPath,
    mimeType: job.mimeType,
  });
};

const resolveGptReferenceAudioId = async () =>
  (await getGptSovitsReferenceAudioId()).refAudioId;

export const synthesizeChatMessageTts = async (thread: ChatThread, message: ChatMessage) => {
  await persistMediaStatus({
    threadId: thread.id,
    messageId: message.id,
    mediaType: "tts",
    status: "running",
  });
  notifyChatMediaUpdated(thread.id, message.id);
  const capabilities = await getMicroAppCapabilities();
  const tts = findCapability(capabilities, "tts");
  if (!tts) {
    const error = new Error("TTS capability is not configured.");
    await persistMediaStatus({
      threadId: thread.id,
      messageId: message.id,
      mediaType: "tts",
      status: "failed",
      errorMessage: error.message,
    });
    throw error;
  }
  try {
    await runTts(thread, message, tts.providerId as TtsProviderId);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error("TTS synthesis failed.");
    await persistMediaStatus({
      threadId: thread.id,
      messageId: message.id,
      mediaType: "tts",
      status: "failed",
      errorMessage: failure.message,
    });
    throw failure;
  }
};

const persistMediaStatus = async ({
  threadId,
  messageId,
  mediaType,
  status,
  errorMessage,
}: {
  threadId: string;
  messageId: string;
  mediaType: "tts" | "image";
  status: "running" | "failed";
  errorMessage?: string;
}) => {
  let latestMessage: Awaited<ReturnType<typeof getThreadById>>["messages"][number] | undefined;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const latestThread = await getThreadById(threadId);
    latestMessage = latestThread.messages.find((item) => item.id === messageId);
    if (latestMessage) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!latestMessage) {
    throw new Error("Assistant message was not persisted before media metadata update.");
  }
  const latestMedia = latestMessage?.metadata?.media;
  const media = latestMedia && typeof latestMedia === "object" && !Array.isArray(latestMedia)
    ? { ...(latestMedia as Record<string, unknown>) }
    : {};
  await updateChatMessageMetadata(threadId, messageId, {
    ...(latestMessage?.metadata ?? {}),
    media: {
      ...media,
      [mediaType]: {
        status,
        ...(errorMessage ? { errorMessage } : {}),
      },
    },
  });
};

const runImage = async (thread: ChatThread, message: ChatMessage, providerId: string) => {
  const prompt = assistantText(message);
  if (!prompt) return;
  const request = providerId === "comfyui_local"
    ? await buildComfyUiRequest(prompt)
    : { providerId, prompt, count: 1 };
  let job = await createImageGeneration(request);

  for (let attempt = 0; attempt < 75; attempt += 1) {
    if (job.status === "succeeded") break;
    if (["failed", "cancelled", "blocked"].includes(job.status)) {
      throw new Error(job.error?.message ?? `Image generation ended with status: ${job.status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
    job = await getImageGeneration(job.generationId, { refresh: true });
  }

  if (job.status !== "succeeded") {
    throw new Error("Image generation did not complete before the polling window ended.");
  }
  const artifact = job.artifacts.find((item) => item.localPath);
  if (!artifact?.localPath) throw new Error("Image generation did not produce a local artifact.");
  await attachChatMedia(thread.id, {
    messageId: message.id,
    taskId: job.generationId,
    mediaType: "image",
    absolutePath: artifact.localPath,
    mimeType: artifact.mimeType,
  });
};

const buildComfyUiRequest = async (prompt: string) => {
  const [flows, connections] = await Promise.all([
    listComfyUiFlows(),
    listComfyUiConnections(),
  ]);
  const flow = flows[0];
  if (!flow) {
    throw new Error("No ComfyUI workflow is configured for chat image generation.");
  }
  const connection = connections[0] ?? null;
  const workflow = JSON.parse(flow.workflowApiJson) as Record<string, { inputs?: Record<string, unknown> }>;
  const [nodeId, ...path] = flow.mapping.promptPath.split(".");
  if (nodeId && path.length > 0 && workflow[nodeId]) {
    const inputs = workflow[nodeId].inputs ?? (workflow[nodeId].inputs = {});
    let current = inputs;
    for (let index = 0; index < path.length - 1; index += 1) {
      const key = path[index];
      const next = current[key];
      if (!next || typeof next !== "object" || Array.isArray(next)) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[path[path.length - 1]] = prompt;
  }

  return {
    providerId: "comfyui_local",
    prompt,
    count: 1,
    workflowApiJson: workflow as Record<string, unknown>,
    providerParams: connection
      ? {
          baseUrl: connection.baseUrl,
          clientId: connection.clientId || undefined,
        }
      : undefined,
  };
};

export const generateChatMessageImage = async (thread: ChatThread, message: ChatMessage) => {
  await persistMediaStatus({
    threadId: thread.id,
    messageId: message.id,
    mediaType: "image",
    status: "running",
  });
  try {
    const capabilities = await getMicroAppCapabilities();
    const image = findCapability(capabilities, "imageGeneration");
    if (!image) throw new Error("Image generation capability is not configured.");
    await runImage(thread, message, image.providerId);
    notifyChatMediaUpdated(thread.id, message.id);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error("Image generation failed.");
    await persistMediaStatus({
      threadId: thread.id,
      messageId: message.id,
      mediaType: "image",
      status: "failed",
      errorMessage: failure.message,
    });
    throw failure;
  }
};

export const createChatMediaLifecyclePolicy = (
  base: ChatSendLifecyclePolicy = {},
): ChatSendLifecyclePolicy => ({
  ...base,
  async afterSendSuccess(input) {
    await base.afterSendSuccess?.(input);
    const settings = asSettings(input.thread);
    const roleId = input.thread.metadata?.roleId;
    const knowledgeBaseId = input.thread.metadata?.knowledgeBaseId;
    const media = shouldGenerateChatMedia({ settings, roleId, knowledgeBaseId });
    if (!media.image && !media.tts) return;

    const runMedia = async () => {
      let capabilities: Awaited<ReturnType<typeof getMicroAppCapabilities>> = [];
      let capabilityError: Error | null = null;
      try {
        capabilities = await getMicroAppCapabilities();
      } catch (error) {
        capabilityError = error instanceof Error ? error : new Error("Failed to load media capabilities");
      }
      const tts = media.tts ? findCapability(capabilities, "tts") : null;
      const image = media.image ? findCapability(capabilities, "imageGeneration") : null;
      if (media.tts) {
        await persistMediaStatus({ threadId: input.thread.id, messageId: input.assistantMessage.id, mediaType: "tts", status: "running" });
      }
      if (media.image) {
        await persistMediaStatus({ threadId: input.thread.id, messageId: input.assistantMessage.id, mediaType: "image", status: "running" });
      }
      notifyChatMediaUpdated(input.thread.id, input.assistantMessage.id);
      const taskResults = await Promise.allSettled([
        media.tts
          ? tts
            ? runTts(input.thread, input.assistantMessage, tts.providerId)
            : Promise.reject(capabilityError ?? new Error("TTS capability is not configured."))
          : Promise.resolve(),
        media.image
          ? image
            ? runImage(input.thread, input.assistantMessage, image.providerId)
            : Promise.reject(capabilityError ?? new Error("Image generation capability is not configured."))
          : Promise.resolve(),
      ]);
      for (let index = 0; index < taskResults.length; index += 1) {
        const result = taskResults[index];
        if (result.status !== "fulfilled") {
          const mediaType = index === 0 ? "tts" : "image";
          const errorMessage = result.reason instanceof Error ? result.reason.message : "Media task failed";
          await persistMediaStatus({
            threadId: input.thread.id,
            messageId: input.assistantMessage.id,
            mediaType,
            status: "failed",
            errorMessage,
          });
        }
      }
      globalThis.window?.dispatchEvent(new CustomEvent("uichat:chat-media-updated", {
        detail: { threadId: input.thread.id, messageId: input.assistantMessage.id },
      }));
    };
    void runMedia().catch(async (error) => {
      const failureMessage = error instanceof Error ? error.message : "Media task failed";
      if (media.tts) {
        await persistMediaStatus({ threadId: input.thread.id, messageId: input.assistantMessage.id, mediaType: "tts", status: "failed", errorMessage: failureMessage }).catch(() => undefined);
      }
      if (media.image) {
        await persistMediaStatus({ threadId: input.thread.id, messageId: input.assistantMessage.id, mediaType: "image", status: "failed", errorMessage: failureMessage }).catch(() => undefined);
      }
      globalThis.window?.dispatchEvent(new CustomEvent("uichat:chat-media-updated", {
        detail: { threadId: input.thread.id, messageId: input.assistantMessage.id },
      }));
      console.error("[chat-media] post-assistant media task failed", error);
    });
  },
});
