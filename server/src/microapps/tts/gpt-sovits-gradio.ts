import fs from "node:fs/promises";
import path from "node:path";
import { fetchJsonWithTimeout } from "@/utils/http.js";

const DEFAULT_GPT_SOVITS_SERVICE_URL = "http://127.0.0.1:9872";
const RIFF_HEADER = "RIFF";
const WAVE_HEADER = "WAVE";
const FMT_CHUNK = "fmt ";
const DATA_CHUNK = "data";
const WAV_PCM_FORMAT = 1;
const GPT_SOVITS_OUTPUT_TARGET_PEAK = 0.9;
const GPT_SOVITS_OUTPUT_MAX_GAIN = 2.5;
const GPT_SOVITS_OUTPUT_MIN_PEAK = 0.01;

type GradioChoice = string | [string, string] | [string, number];

type GradioUpdate = {
  __type__?: string;
  choices?: GradioChoice[];
  value?: string | number | boolean | null;
  visible?: boolean;
};

type GradioEndpointParameter = {
  parameter_name?: string;
  parameter_default?: unknown;
  type?: {
    enum?: unknown[];
  };
};

type GradioInfoResponse = {
  named_endpoints?: Record<
    string,
    {
      parameters?: GradioEndpointParameter[];
    }
  >;
};

type GradioCallStartResponse = {
  event_id?: string;
};

type GradioFileData = {
  path?: string;
  url?: string | null;
  mime_type?: string | null;
  orig_name?: string | null;
};

type GptSovitsCatalogDefaults = {
  serviceUrl: string;
  promptText: string;
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

export type GptSovitsCatalog = {
  serviceUrl: string;
  gptModelOptions: string[];
  sovitsModelOptions: string[];
  languageOptions: string[];
  cutMethodOptions: string[];
  sampleStepOptions: number[];
  defaults: GptSovitsCatalogDefaults;
};

export type GptSovitsSynthesisRequest = {
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
  refAudioPath: string;
};

const normalizeBaseUrl = (value: unknown) => {
  const baseUrl =
    typeof value === "string" && value.trim()
      ? value.trim()
      : DEFAULT_GPT_SOVITS_SERVICE_URL;
  return baseUrl.replace(/\/+$/, "");
};

const isHttpUrl = (value: string) => /^https?:\/\//iu.test(value);

const toStringOption = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const candidate = value[1] ?? value[0];
    return typeof candidate === "string" || typeof candidate === "number"
      ? String(candidate)
      : "";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
};

const toStringOptions = (values: unknown[] | undefined): string[] =>
  (values ?? []).map(toStringOption).filter(Boolean);

const toNumber = (value: unknown, fallback: number) => {
  const next =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(next) ? next : fallback;
};

const pickOption = (value: unknown, options: string[], fallback = "") => {
  if (typeof value === "string" && value.trim() && options.includes(value.trim())) {
    return value.trim();
  }
  if (fallback && options.includes(fallback)) {
    return fallback;
  }
  return options[0] ?? fallback;
};

const pickNumberOption = (value: unknown, options: number[], fallback: number) => {
  const next = toNumber(value, Number.NaN);
  if (Number.isFinite(next) && options.includes(next)) {
    return next;
  }
  if (options.includes(fallback)) {
    return fallback;
  }
  return options[0] ?? fallback;
};

const parseSseJsonPayload = <T>(content: string): T => {
  const events = content
    .split(/\r?\n\r?\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  let sawErrorEvent = false;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const lines = events[index].split(/\r?\n/);
    const eventName = lines
      .find((line) => line.startsWith("event:"))
      ?.slice("event:".length)
      .trim();

    const dataText = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .join("\n");

    if (eventName === "error") {
      sawErrorEvent = true;
      if (dataText && dataText !== "null") {
        throw new Error(`GPT-SoVITS Gradio returned error event: ${dataText}`);
      }
      continue;
    }

    if (eventName !== "complete") {
      continue;
    }

    if (!dataText) {
      break;
    }

    return JSON.parse(dataText) as T;
  }

  if (sawErrorEvent) {
    throw new Error("GPT-SoVITS Gradio returned an error event.");
  }

  throw new Error("GPT-SoVITS Gradio call did not return a complete event.");
};

const callGradioEndpoint = async <T>(
  baseUrl: string,
  endpointName: string,
  data: unknown[],
  timeoutMs = 120_000,
) => {
  const start = await fetchJsonWithTimeout<GradioCallStartResponse>(
    `${baseUrl}/call/${endpointName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data }),
    },
    timeoutMs,
  );

  if (!start.event_id) {
    throw new Error(`GPT-SoVITS Gradio call failed to start: ${endpointName}`);
  }

  const response = await fetch(`${baseUrl}/call/${endpointName}/${start.event_id}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `GPT-SoVITS Gradio call failed: ${endpointName}`);
  }

  return parseSseJsonPayload<T>(await response.text());
};

const readEndpointParameters = (
  info: GradioInfoResponse,
  endpointName: string,
) => info.named_endpoints?.[endpointName]?.parameters ?? [];

const getParameterByName = (
  parameters: GradioEndpointParameter[],
  name: string,
) => parameters.find((item) => item.parameter_name === name);

const readChunkId = (bytes: Buffer, offset: number) =>
  bytes.subarray(offset, offset + 4).toString("ascii");

export const applyGptSovitsOutputGain = (bytes: Buffer, mimeType: string) => {
  if (!/audio\/wav/iu.test(mimeType)) {
    return bytes;
  }

  if (bytes.length < 44 || readChunkId(bytes, 0) !== RIFF_HEADER || readChunkId(bytes, 8) !== WAVE_HEADER) {
    return bytes;
  }

  let audioFormat = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkId = readChunkId(bytes, offset);
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;

    if (chunkDataOffset + chunkSize > bytes.length) {
      return bytes;
    }

    if (chunkId === FMT_CHUNK && chunkSize >= 16) {
      audioFormat = bytes.readUInt16LE(chunkDataOffset);
      bitsPerSample = bytes.readUInt16LE(chunkDataOffset + 14);
    } else if (chunkId === DATA_CHUNK) {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
      break;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (audioFormat !== WAV_PCM_FORMAT || bitsPerSample !== 16 || dataOffset < 0 || dataSize < 2) {
    return bytes;
  }

  let peak = 0;
  for (let sampleOffset = dataOffset; sampleOffset + 1 < dataOffset + dataSize; sampleOffset += 2) {
    const normalized = Math.abs(bytes.readInt16LE(sampleOffset)) / 32768;
    if (normalized > peak) {
      peak = normalized;
    }
  }

  if (peak < GPT_SOVITS_OUTPUT_MIN_PEAK || peak >= GPT_SOVITS_OUTPUT_TARGET_PEAK) {
    return bytes;
  }

  const gain = Math.min(
    GPT_SOVITS_OUTPUT_TARGET_PEAK / peak,
    GPT_SOVITS_OUTPUT_MAX_GAIN,
  );
  if (gain <= 1) {
    return bytes;
  }

  const output = Buffer.from(bytes);
  for (let sampleOffset = dataOffset; sampleOffset + 1 < dataOffset + dataSize; sampleOffset += 2) {
    const amplified = Math.round(output.readInt16LE(sampleOffset) * gain);
    const clipped = Math.max(-32768, Math.min(32767, amplified));
    output.writeInt16LE(clipped, sampleOffset);
  }

  return output;
};

const copyGeneratedAudio = async (
  fileData: GradioFileData,
  outputPath: string,
  baseUrl: string,
) => {
  const localPath = typeof fileData.path === "string" ? fileData.path.trim() : "";
  if (localPath) {
    try {
      const mimeType = fileData.mime_type?.trim() || "audio/wav";
      const bytes = await fs.readFile(localPath);
      await fs.writeFile(outputPath, applyGptSovitsOutputGain(bytes, mimeType));
      return mimeType;
    } catch {
      // Fall through to URL download when the path is not readable from our backend process.
    }
  }

  const rawUrl = typeof fileData.url === "string" ? fileData.url.trim() : "";
  if (!rawUrl) {
    throw new Error("GPT-SoVITS did not return a readable audio artifact.");
  }

  const downloadUrl = rawUrl.startsWith("http")
    ? rawUrl
    : `${baseUrl}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to download GPT-SoVITS audio output.");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const mimeType =
    fileData.mime_type?.trim() || response.headers.get("content-type") || "audio/wav";
  await fs.writeFile(outputPath, applyGptSovitsOutputGain(bytes, mimeType));
  return mimeType;
};

export const getDefaultGptSovitsServiceUrl = () => DEFAULT_GPT_SOVITS_SERVICE_URL;

export const loadGptSovitsCatalog = async (
  providerConfig: Record<string, unknown>,
): Promise<GptSovitsCatalog> => {
  const serviceUrl = normalizeBaseUrl(providerConfig.baseUrl);
  const info = await fetchJsonWithTimeout<GradioInfoResponse>(
    `${serviceUrl}/info?serialize=false`,
  );
  const modelChoiceUpdates = await callGradioEndpoint<GradioUpdate[]>(
    serviceUrl,
    "change_choices",
    [],
  );

  const getTtsParameters = readEndpointParameters(info, "/get_tts_wav");
  const gptModelOptions = toStringOptions(modelChoiceUpdates[1]?.choices);
  const sovitsModelOptions = toStringOptions(modelChoiceUpdates[0]?.choices);
  const languageOptions = toStringOptions(
    getParameterByName(getTtsParameters, "prompt_language")?.type?.enum,
  );
  const cutMethodOptions = toStringOptions(
    getParameterByName(getTtsParameters, "how_to_cut")?.type?.enum,
  );
  const sampleStepOptions = toStringOptions(
    getParameterByName(getTtsParameters, "sample_steps")?.type?.enum,
  )
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

  const promptLanguageDefault = toStringOption(
    getParameterByName(getTtsParameters, "prompt_language")?.parameter_default,
  );
  const textLanguageDefault = toStringOption(
    getParameterByName(getTtsParameters, "text_language")?.parameter_default,
  );
  const cutMethodDefault = toStringOption(
    getParameterByName(getTtsParameters, "how_to_cut")?.parameter_default,
  );

  const defaults: GptSovitsCatalogDefaults = {
    serviceUrl,
    promptText:
      typeof providerConfig.promptText === "string" ? providerConfig.promptText.trim() : "",
    gptModel: pickOption(providerConfig.gptModel, gptModelOptions),
    sovitsModel: pickOption(providerConfig.sovitsModel, sovitsModelOptions),
    promptLanguage: pickOption(
      providerConfig.promptLanguage,
      languageOptions,
      promptLanguageDefault,
    ),
    textLanguage: pickOption(
      providerConfig.textLanguage,
      languageOptions,
      textLanguageDefault,
    ),
    cutMethod: pickOption(providerConfig.cutMethod, cutMethodOptions, cutMethodDefault),
    sampleSteps: pickNumberOption(
      providerConfig.sampleSteps,
      sampleStepOptions,
      toNumber(getParameterByName(getTtsParameters, "sample_steps")?.parameter_default, 8),
    ),
    speed: toNumber(
      providerConfig.speed,
      toNumber(getParameterByName(getTtsParameters, "speed")?.parameter_default, 1),
    ),
    pauseSecond: toNumber(
      providerConfig.pauseSecond,
      toNumber(getParameterByName(getTtsParameters, "pause_second")?.parameter_default, 0.3),
    ),
    temperature: toNumber(
      providerConfig.temperature,
      toNumber(getParameterByName(getTtsParameters, "temperature")?.parameter_default, 1),
    ),
    topK: toNumber(
      providerConfig.topK,
      toNumber(getParameterByName(getTtsParameters, "top_k")?.parameter_default, 15),
    ),
    topP: toNumber(
      providerConfig.topP,
      toNumber(getParameterByName(getTtsParameters, "top_p")?.parameter_default, 1),
    ),
  };

  return {
    serviceUrl,
    gptModelOptions,
    sovitsModelOptions,
    languageOptions,
    cutMethodOptions,
    sampleStepOptions,
    defaults,
  };
};

export const synthesizeWithGptSovits = async (input: {
  providerConfig: Record<string, unknown>;
  request: GptSovitsSynthesisRequest;
  outputPath: string;
}) => {
  const { providerConfig, request, outputPath } = input;
  const serviceUrl = normalizeBaseUrl(providerConfig.baseUrl);
  const refAudioPath = (request.refAudioPath ?? "").trim();

  if (!refAudioPath) {
    throw new Error("GPT-SoVITS reference audio path is required.");
  }

  if (!isHttpUrl(refAudioPath)) {
    await fs.access(refAudioPath);
  }

  const refAudioFileData = isHttpUrl(refAudioPath)
    ? {
        path: refAudioPath,
        url: refAudioPath,
        orig_name: path.basename(refAudioPath),
        mime_type: "audio/wav",
        meta: { _type: "gradio.FileData" },
      }
    : {
        path: refAudioPath,
        meta: { _type: "gradio.FileData" },
      };

  await callGradioEndpoint<unknown[]>(serviceUrl, "change_gpt_weights", [request.gptModel]);
  await callGradioEndpoint<unknown[]>(serviceUrl, "change_sovits_weights", [
    request.sovitsModel,
    request.promptLanguage,
    request.textLanguage,
  ]);

  const result = await callGradioEndpoint<GradioFileData[]>(
    serviceUrl,
    "get_tts_wav",
    [
      refAudioFileData,
      request.promptText,
      request.promptLanguage,
      request.text,
      request.textLanguage,
      request.cutMethod,
      request.topK,
      request.topP,
      request.temperature,
      false,
      request.speed,
      false,
      [],
      request.sampleSteps,
      false,
      request.pauseSecond,
      true,
    ],
    300_000,
  );

  const fileData = result[0];
  if (!fileData) {
    throw new Error("GPT-SoVITS did not return any audio artifact.");
  }

  const mimeType = await copyGeneratedAudio(fileData, outputPath, serviceUrl);
  return {
    mimeType,
    providerMeta: {
      serviceUrl,
      sourcePath:
        typeof fileData.path === "string" && fileData.path.trim()
          ? path.normalize(fileData.path)
          : null,
    },
  };
};
