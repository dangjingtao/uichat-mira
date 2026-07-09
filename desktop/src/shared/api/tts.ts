import { client, get, post, put } from "@/shared/lib/request";

const TTS_ROUTE = "/microapps/tts";

export type TtsProviderId = "windows_builtin" | "piper_local" | "gpt_sovits";
export type TtsSynthesisStatus = "queued" | "running" | "succeeded" | "failed";

export interface TtsProviderConfigRecord {
  id: string;
  providerId: TtsProviderId;
  displayName: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TtsSynthesisJobRecord {
  id: string;
  providerId: TtsProviderId;
  status: TtsSynthesisStatus;
  text: string;
  voice: string | null;
  requestConfig: Record<string, unknown>;
  outputPath: string | null;
  mimeType: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TtsVoiceSummary {
  id: string;
  label: string;
  providerId: TtsProviderId;
}

export interface TtsOverview {
  providers: TtsProviderConfigRecord[];
  recentJobs: TtsSynthesisJobRecord[];
}

export interface UpdateTtsProviderPayload {
  enabled?: boolean;
  displayName?: string;
  config?: Record<string, unknown>;
}

export interface CreateTtsSynthesisPayload {
  providerId: TtsProviderId;
  text: string;
  voice?: string;
  rate?: number;
  volume?: number;
}

export interface GptSovitsCatalog {
  serviceUrl: string;
  gptModelOptions: string[];
  sovitsModelOptions: string[];
  languageOptions: string[];
  cutMethodOptions: string[];
  sampleStepOptions: number[];
  defaults: {
    serviceUrl: string;
    gptModel: string;
    sovitsModel: string;
    promptLanguage: string;
    textLanguage: string;
    cutMethod: string;
    sampleSteps: number;
    speed: number;
    pauseSecond: number;
    temperature: number;
    topK: number;
    topP: number;
  };
}

export interface CreateGptSovitsSynthesisPayload {
  text: string;
  promptText: string;
  promptLanguage: string;
  textLanguage: string;
  gptModel: string;
  sovitsModel: string;
  cutMethod: string;
  sampleSteps: number;
  speed: number;
  pauseSecond: number;
  temperature: number;
  topK: number;
  topP: number;
  refAudioPath?: string;
  refAudioFile?: File;
}

export function getTtsOverview() {
  return get<TtsOverview>(`${TTS_ROUTE}/overview`);
}

export function updateTtsProvider(
  providerId: TtsProviderId,
  payload: UpdateTtsProviderPayload,
) {
  return put<{ provider: TtsProviderConfigRecord }>(
    `${TTS_ROUTE}/providers/${encodeURIComponent(providerId)}`,
    payload,
  );
}

export function getTtsVoices(providerId: TtsProviderId) {
  return get<{ voices: TtsVoiceSummary[] }>(
    `${TTS_ROUTE}/voices?providerId=${encodeURIComponent(providerId)}`,
  );
}

export function createTtsSynthesis(payload: CreateTtsSynthesisPayload) {
  return post<{ job: TtsSynthesisJobRecord }>(`${TTS_ROUTE}/syntheses`, payload, {
    timeout: 0,
  });
}

export function getGptSovitsCatalog() {
  return get<{ catalog: GptSovitsCatalog }>(`${TTS_ROUTE}/gpt-sovits/catalog`);
}

export function createGptSovitsSynthesis(payload: CreateGptSovitsSynthesisPayload) {
  if (payload.refAudioFile) {
    const formData = new FormData();
    formData.append("refAudioFile", payload.refAudioFile);
    formData.append("text", payload.text);
    formData.append("promptText", payload.promptText);
    formData.append("promptLanguage", payload.promptLanguage);
    formData.append("textLanguage", payload.textLanguage);
    formData.append("gptModel", payload.gptModel);
    formData.append("sovitsModel", payload.sovitsModel);
    formData.append("cutMethod", payload.cutMethod);
    formData.append("sampleSteps", String(payload.sampleSteps));
    formData.append("speed", String(payload.speed));
    formData.append("pauseSecond", String(payload.pauseSecond));
    formData.append("temperature", String(payload.temperature));
    formData.append("topK", String(payload.topK));
    formData.append("topP", String(payload.topP));

    return post<{ job: TtsSynthesisJobRecord }>(
      `${TTS_ROUTE}/gpt-sovits/syntheses`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 0,
      },
    );
  }

  return post<{ job: TtsSynthesisJobRecord }>(
    `${TTS_ROUTE}/gpt-sovits/syntheses`,
    payload,
    {
      timeout: 0,
    },
  );
}

export function getTtsSynthesis(jobId: string) {
  return get<{ job: TtsSynthesisJobRecord }>(
    `${TTS_ROUTE}/syntheses/${encodeURIComponent(jobId)}`,
  );
}

export function getTtsAudioUrl(jobId: string) {
  return `${TTS_ROUTE}/syntheses/${encodeURIComponent(jobId)}/audio`;
}

export async function getTtsAudioPreviewUrl(jobId: string) {
  const response = await client.get<Blob>(getTtsAudioUrl(jobId), {
    responseType: "blob",
  });

  return URL.createObjectURL(response.data);
}
