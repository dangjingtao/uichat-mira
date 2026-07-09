import { get, post, put } from "@/shared/lib/request";
import { getApiBaseUrl } from "@/shared/platform/desktopRuntime";

const TTS_ROUTE = "/microapps/tts";

export type TtsProviderId = "windows_builtin" | "piper_local";
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

export function getTtsSynthesis(jobId: string) {
  return get<{ job: TtsSynthesisJobRecord }>(
    `${TTS_ROUTE}/syntheses/${encodeURIComponent(jobId)}`,
  );
}

export function getTtsAudioUrl(jobId: string) {
  return `${getApiBaseUrl()}${TTS_ROUTE}/syntheses/${encodeURIComponent(jobId)}/audio`;
}
