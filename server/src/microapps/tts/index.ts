import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { modelConfigRepository } from "@/db/repositories/model-config.repository.js";
import { providerConnectionRepository } from "@/db/repositories/provider-settings.repository.js";
import {
  ttsProviderConfigsRepository,
  type TtsProviderConfigRecord,
} from "@/db/repositories/tts-provider-configs.repository.js";
import {
  ttsSynthesisJobsRepository,
  type TtsSynthesisJobRecord,
} from "@/db/repositories/tts-synthesis-jobs.repository.js";
import { ttsRefAudioStorageService } from "@/services/tts-ref-audio-storage.service.js";
import {
  getDefaultGptSovitsServiceUrl,
  loadGptSovitsCatalog,
  synthesizeWithGptSovits,
  type GptSovitsCatalog,
  type GptSovitsSynthesisRequest,
} from "./gpt-sovits-gradio.js";
import { getProviderDefinition } from "@/providers/catalog.js";
import { llmService } from "@/services/llm.service.js";
import { resolveProviderForRole } from "@/services/provider-proxy.service/resolution.js";
export type {
  GptSovitsCatalog,
  GptSovitsSynthesisRequest,
} from "./gpt-sovits-gradio.js";

export type TtsProviderId =
  | "windows_builtin"
  | "piper_local"
  | "gpt_sovits"
  | "api_provider";
export type TtsSynthesisStatus = "queued" | "running" | "succeeded" | "failed";

export type TtsVoiceSummary = {
  id: string;
  label: string;
  providerId: TtsProviderId;
};

export type TtsSynthesisRequest = {
  providerId: TtsProviderId;
  text: string;
  voice?: string;
  rate?: number;
  volume?: number;
  speed?: number;
  responseFormat?: string;
};

type ResolvedBaseSynthesisRequest = {
  voice: string | null;
  rate: number;
  volume: number;
};

export type TtsOverview = {
  providers: TtsProviderConfigRecord[];
  recentJobs: TtsSynthesisJobRecord[];
};

export type ApiProviderCatalog = {
  configured: boolean;
  supported: boolean;
  providerConnectionId: string | null;
  providerDisplayName: string;
  providerCode: string | null;
  providerTemplateCode: string | null;
  baseUrl: string;
  modelId: string;
  modelName: string;
  errorMessage: string | null;
};

export type TtsService = ReturnType<typeof createTtsService>;

const WINDOWS_PROVIDER_ID: TtsProviderId = "windows_builtin";
const PIPER_PROVIDER_ID: TtsProviderId = "piper_local";
const GPT_SOVITS_PROVIDER_ID: TtsProviderId = "gpt_sovits";
const API_PROVIDER_ID: TtsProviderId = "api_provider";
const OPENAI_COMPATIBLE_VOICE_PROVIDER_CODES = new Set([
  "openai",
  "google",
  "volcengine",
]);
const speechResponseMimeTypes: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  opus: "audio/ogg",
  flac: "audio/flac",
  pcm: "audio/wav",
};

const nowIso = () => new Date().toISOString();

const ensureDir = async (targetPath: string) => {
  await fs.mkdir(targetPath, { recursive: true });
};

const findWorkspaceRoot = (startDir: string) => {
  let currentDir = path.resolve(startDir);

  while (true) {
    const hasWorkspaceMarker =
      fsSync.existsSync(path.join(currentDir, "runtime.config.cjs")) ||
      fsSync.existsSync(path.join(currentDir, "pnpm-workspace.yaml"));

    if (hasWorkspaceMarker) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return path.resolve(startDir);
    }

    currentDir = parentDir;
  }
};

const resolveWorkspacePath = (...segments: string[]) =>
  path.join(findWorkspaceRoot(process.cwd()), ...segments);

const listManagedPiperExecutables = () => {
  const runtimeRoot = resolveWorkspacePath(
    ".local-runtimes",
    "piper",
    "windows-amd64",
  );
  if (!fsSync.existsSync(runtimeRoot)) {
    return [];
  }

  return fsSync
    .readdirSync(runtimeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      path.join(runtimeRoot, entry.name, "extracted", "piper", "piper.exe"),
    )
    .reverse();
};

const runProcess = async (
  command: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    stdinText?: string;
    cwd?: string;
  } = {},
) => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...options.env,
      },
      cwd: options.cwd,
      windowsHide: true,
    });

    const stderrChunks: Buffer[] = [];
    const stdoutChunks: Buffer[] = [];

    child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
      const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();
      reject(
        new Error(
          stderr || stdout || `Process exited with code ${code ?? "unknown"}`,
        ),
      );
    });

    if (options.stdinText) {
      child.stdin.write(options.stdinText, "utf8");
    }
    child.stdin.end();
  });
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getConfigString = (config: Record<string, unknown>, key: string) =>
  typeof config[key] === "string" ? config[key].trim() : "";

const getConfigNumber = (config: Record<string, unknown>, key: string) => {
  const raw = config[key];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Number.NaN;
};

const createEmptyApiProviderCatalog = (
  errorMessage: string,
  supported = false,
): ApiProviderCatalog => ({
  configured: false,
  supported,
  providerConnectionId: null,
  providerDisplayName: "",
  providerCode: null,
  providerTemplateCode: null,
  baseUrl: "",
  modelId: "",
  modelName: "",
  errorMessage,
});

const isSupportedApiVoiceProvider = (providerCode: string) =>
  OPENAI_COMPATIBLE_VOICE_PROVIDER_CODES.has(providerCode);

const getApiProviderVoiceConfig = (config: Record<string, unknown>) => {
  const voice =
    typeof config.voice === "string" ? config.voice.trim() : "";
  const responseFormat =
    typeof config.responseFormat === "string" ? config.responseFormat.trim().toLowerCase() : "";
  const speed = getConfigNumber(config, "speed");

  return {
    voice,
    responseFormat: speechResponseMimeTypes[responseFormat] ? responseFormat : "mp3",
    speed:
      Number.isFinite(speed) && speed >= 0.25 && speed <= 4
        ? speed
        : 1,
  };
};

const buildOpenAiCompatibleSpeechUrl = (baseUrl: string) =>
  `${baseUrl.replace(/\/+$/, "")}/audio/speech`;

const unsupportedVolcenginePlaceholderVoices = new Set([
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
]);

const isVolcengineSpeechProvider = (input: {
  providerCode?: string | null;
  providerTemplateCode?: string | null;
  baseUrl?: string | null;
}) => {
  const providerCode = input.providerCode?.trim().toLowerCase() ?? "";
  const providerTemplateCode =
    input.providerTemplateCode?.trim().toLowerCase() ?? "";
  const baseUrl = input.baseUrl?.trim().toLowerCase() ?? "";

  return (
    providerCode.includes("volcengine") ||
    providerTemplateCode.includes("volcengine") ||
    baseUrl.includes("openspeech.bytedance.com") ||
    baseUrl.includes("volces.com")
  );
};

const mapVolcengineSpeechFormat = (responseFormat: string) => {
  switch (responseFormat) {
    case "opus":
      return "ogg_opus";
    case "flac":
      return "";
    default:
      return responseFormat;
  }
};

const mapVolcengineSpeechRate = (speed: number) =>
  clampNumber(Math.round((speed - 1) * 100), -50, 100);

const getSpeechResponseMimeType = (
  responseFormat: string,
  contentType: string | null,
) => {
  const normalized = contentType?.trim();
  if (normalized) {
    return normalized;
  }

  return speechResponseMimeTypes[responseFormat] ?? "audio/mpeg";
};

const tryParseJsonObject = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
};

const resolveVolcengineSampleRate = (responseFormat: string) => {
  switch (responseFormat) {
    case "pcm":
      return 16000;
    default:
      return 24000;
  }
};

const decodeVolcengineChunkedAudio = (bytes: Buffer) => {
  const textPayload = bytes.toString("utf-8").trim();
  if (!textPayload) {
    throw new Error("火山方舟语音合成返回了空响应。");
  }

  const chunks = textPayload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const audioChunks: Buffer[] = [];
  let lastMessage = "";

  for (const line of chunks) {
    const payload = tryParseJsonObject(line);
    if (!payload) {
      throw new Error(`火山方舟语音合成返回了无法解析的响应片段：${line}`);
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      lastMessage = payload.message.trim();
    }

    // The unidirectional endpoint ends a successful stream with code 20000000.
    // Audio is delivered by the preceding code 0 chunks.
    const isSuccessfulTerminalCode =
      payload.code === 20000000 || payload.code === "20000000";
    if (
      payload.code !== undefined &&
      payload.code !== 0 &&
      payload.code !== "0" &&
      !isSuccessfulTerminalCode
    ) {
      const message =
        typeof payload.message === "string" && payload.message.trim()
          ? payload.message.trim()
          : lastMessage;
      throw new Error(message || `火山方舟语音合成失败，错误码 ${String(payload.code)}。`);
    }

    if (typeof payload.data === "string" && payload.data.trim()) {
      audioChunks.push(Buffer.from(payload.data, "base64"));
    }
  }

  const merged = Buffer.concat(audioChunks);
  if (!merged.length) {
    throw new Error(
      lastMessage &&
        !/^ok$/iu.test(lastMessage)
        ? lastMessage
        : "火山方舟语音合成接口已返回成功状态，但没有返回音频数据。请检查 voice 模型 ID、speaker / 音色 ID 和账户套餐是否匹配当前接口。",
    );
  }

  return merged;
};

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const basenameWithoutExt = (filePath: string) =>
  path.basename(filePath, path.extname(filePath));

const isHttpUrl = (value: string) => /^https?:\/\//iu.test(value);

const pickRequestString = (
  value: string,
  providerConfig: Record<string, unknown>,
  key: string,
  fallback = "",
) => {
  const trimmed = value.trim();
  if (trimmed) {
    return trimmed;
  }

  const configValue = getConfigString(providerConfig, key);
  return configValue || fallback;
};

const pickRequestNumber = (
  value: number,
  providerConfig: Record<string, unknown>,
  key: string,
  fallback: number,
) => {
  if (Number.isFinite(value)) {
    return value;
  }

  const configValue = getConfigNumber(providerConfig, key);
  return Number.isFinite(configValue) ? configValue : fallback;
};

const sanitizeCantoneseRewrite = (value: string) =>
  value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .replace(/^(转写结果|轉寫結果|粤语本地文字|粵語本地文字)\s*[:：]\s*/iu, "")
    .replace(/\s+/g, " ")
    .trim();

const isCantoneseLanguage = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes("粤语") ||
    normalized.includes("粵語") ||
    normalized.includes("广东话") ||
    normalized.includes("廣東話") ||
    normalized.includes("cantonese") ||
    normalized.includes("yue")
  );
};

const rewriteToCantoneseLocalText = async (
  text: string,
  language: string,
  fieldLabel: "参考文本" | "合成文本",
) => {
  const trimmed = text.trim();
  if (!trimmed || !isCantoneseLanguage(language)) {
    return trimmed;
  }

  let rewritten = "";
  try {
    rewritten = await llmService.generateText({
      roleType: "task",
      messages: [
        {
          role: "system",
          content: [
            "你是粤语本地书写转写器。",
            "把输入文本转成适合香港或广东粤语口语朗读的本地书写。",
            "保留原始语义、专有名词、数字、英文品牌名和英文片段。",
            "不要解释，不要加前缀，不要使用引号，只输出最终转写结果。",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `字段：${fieldLabel}`,
            `目标语种：${language}`,
            "请把下面文本转写成粤语本地文字：",
            trimmed,
          ].join("\n"),
        },
      ],
    });
  } catch (error) {
    return trimmed;
  }

  const sanitized = sanitizeCantoneseRewrite(rewritten);
  if (!sanitized) {
    throw new Error(`任务模型未返回可用的${fieldLabel}粤语转写结果。`);
  }

  return sanitized;
};

const resolveGptSovitsSynthesisRequest = (
  providerConfig: Record<string, unknown>,
  request: GptSovitsSynthesisRequest,
  refAudioPath: string,
) => {
  const resolved = {
    text: request.text.trim(),
    refAudioPath,
    promptText: pickRequestString(request.promptText, providerConfig, "promptText"),
    promptLanguage: pickRequestString(
      request.promptLanguage,
      providerConfig,
      "promptLanguage",
      "中文",
    ),
    textLanguage: pickRequestString(
      request.textLanguage,
      providerConfig,
      "textLanguage",
      "中文",
    ),
    gptModel: pickRequestString(request.gptModel, providerConfig, "gptModel"),
    sovitsModel: pickRequestString(request.sovitsModel, providerConfig, "sovitsModel"),
    cutMethod: pickRequestString(request.cutMethod, providerConfig, "cutMethod", "不切"),
    sampleSteps: pickRequestNumber(request.sampleSteps, providerConfig, "sampleSteps", 8),
    speed: pickRequestNumber(request.speed, providerConfig, "speed", 1),
    pauseSecond: pickRequestNumber(request.pauseSecond, providerConfig, "pauseSecond", 0.3),
    temperature: pickRequestNumber(request.temperature, providerConfig, "temperature", 1),
    topK: pickRequestNumber(request.topK, providerConfig, "topK", 15),
    topP: pickRequestNumber(request.topP, providerConfig, "topP", 1),
  };

  if (!resolved.gptModel) {
    throw new Error("GPT-SoVITS GPT model is required. Please save or select a GPT model first.");
  }
  if (!resolved.sovitsModel) {
    throw new Error(
      "GPT-SoVITS SoVITS model is required. Please save or select a SoVITS model first.",
    );
  }

  return resolved;
};

const validatePiperModelConfig = (config: Record<string, unknown>) => {
  const modelPath =
    typeof config.modelPath === "string" ? config.modelPath.trim() : "";

  if (!modelPath) {
    return;
  }

  if (!fsSync.existsSync(modelPath)) {
    throw new Error(`Piper 语音包文件不存在: ${modelPath}`);
  }

  const modelConfigPath = `${modelPath}.json`;
  if (!fsSync.existsSync(modelConfigPath)) {
    throw new Error(`缺少 Piper 语音包配置文件: ${modelConfigPath}`);
  }

  const rawConfig = fsSync.readFileSync(modelConfigPath, "utf8");
  const parsedConfig = parseJson<Record<string, unknown>>(rawConfig, {});
  const phonemeType =
    typeof parsedConfig.phoneme_type === "string"
      ? parsedConfig.phoneme_type.trim().toLowerCase()
      : "";

  if (phonemeType && phonemeType !== "espeak") {
    throw new Error(
      `当前内置 Piper 运行时只支持 phoneme_type=espeak 的语音包。你这个语音包是 ${phonemeType}，暂不支持。`,
    );
  }
};

const resolveBaseSynthesisRequest = (
  provider: TtsProviderConfigRecord,
): ResolvedBaseSynthesisRequest => {
  if (provider.providerId === WINDOWS_PROVIDER_ID) {
    const defaultVoice =
      typeof provider.config.defaultVoice === "string"
        ? provider.config.defaultVoice.trim()
        : "";
    const rate =
      typeof provider.config.rate === "number" ? provider.config.rate : 0;
    const volume =
      typeof provider.config.volume === "number" ? provider.config.volume : 100;

    return {
      voice: defaultVoice || null,
      rate: clampNumber(Math.round(rate), -10, 10),
      volume: clampNumber(Math.round(volume), 0, 100),
    };
  }

  const speaker =
    typeof provider.config.speaker === "string" ? provider.config.speaker.trim() : "";

  return {
    voice: speaker || null,
    rate: 0,
    volume: 100,
  };
};

const resolveBundledPiperExecutablePath = async () => {
  const processWithResourcesPath = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  const candidates = [
    process.env.UIC_TTS_PIPER_EXECUTABLE,
    ...listManagedPiperExecutables(),
    resolveWorkspacePath(".artifacts", "micro-apps", "tts", "piper", "piper.exe"),
    path.resolve(
      path.dirname(process.execPath),
      "..",
      "micro-apps",
      "tts",
      "piper",
      "piper.exe",
    ),
    processWithResourcesPath.resourcesPath
      ? path.resolve(
          processWithResourcesPath.resourcesPath,
          "micro-apps",
          "tts",
          "piper",
          "piper.exe",
        )
      : "",
  ]
    .map((item) => item?.trim() ?? "")
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Keep scanning known managed runtime locations.
    }
  }

  throw new Error(
    "Bundled Piper runtime was not found. Expected piper.exe in the TTS micro-app Piper resources.",
  );
};

const formatWindowsVoiceLanguage = (culture: string) => {
  const normalized = culture.trim().toLowerCase();
  if (!normalized) {
    return "未知语言";
  }
  if (normalized.startsWith("zh")) {
    return "中文";
  }
  if (normalized.startsWith("en")) {
    return "English";
  }
  return culture;
};

const listWindowsVoices = async (): Promise<TtsVoiceSummary[]> => {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Speech",
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "$voices = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo } | ForEach-Object { [PSCustomObject]@{ id = $_.Name; label = $_.Name; culture = $_.Culture.Name } }",
    "$synth.Dispose()",
    "$voices | ConvertTo-Json -Compress",
  ].join("; ");

  let json = "[]";

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-Command", script],
      {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            Buffer.concat(stderrChunks).toString("utf8").trim() ||
              `Failed to list Windows voices with code ${code ?? "unknown"}`,
          ),
        );
        return;
      }
      json = Buffer.concat(stdoutChunks).toString("utf8").trim() || "[]";
      resolve();
    });
  });

  const raw = parseJson<
    Array<{ id: string; label: string; culture?: string }> | { id: string; label: string; culture?: string }
  >(
    json,
    [],
  );
  const items = Array.isArray(raw) ? raw : [raw];
  return items
    .filter((item) => item?.id)
    .map((item) => ({
      id: item.id,
      label: `${formatWindowsVoiceLanguage(item.culture ?? "")} · ${item.label || item.id}${
        item.culture ? ` (${item.culture})` : ""
      }`,
      providerId: WINDOWS_PROVIDER_ID,
    }));
};

const synthesizeWithWindowsVoice = async (
  outputPath: string,
  request: TtsSynthesisRequest,
) => {
  const textBase64 = Buffer.from(request.text, "utf8").toString("base64");
  const rate = clampNumber(Math.round(request.rate ?? 0), -10, 10);
  const volume = clampNumber(Math.round(request.volume ?? 100), 0, 100);
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Speech",
    "$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:UIC_TTS_TEXT_B64))",
    "$voice = $env:UIC_TTS_VOICE",
    "$output = $env:UIC_TTS_OUTPUT",
    "$rate = [int]$env:UIC_TTS_RATE",
    "$volume = [int]$env:UIC_TTS_VOLUME",
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "if ($voice) { $synth.SelectVoice($voice) }",
    "$synth.Rate = $rate",
    "$synth.Volume = $volume",
    "$synth.SetOutputToWaveFile($output)",
    "$synth.Speak($text)",
    "$synth.Dispose()",
  ].join("; ");

  await runProcess("powershell.exe", ["-NoProfile", "-Command", script], {
    env: {
      UIC_TTS_TEXT_B64: textBase64,
      UIC_TTS_VOICE: request.voice ?? "",
      UIC_TTS_OUTPUT: outputPath,
      UIC_TTS_RATE: String(rate),
      UIC_TTS_VOLUME: String(volume),
    },
  });
};

const listPiperVoices = async (
  config: TtsProviderConfigRecord,
): Promise<TtsVoiceSummary[]> => {
  const modelPath =
    typeof config.config.modelPath === "string" ? config.config.modelPath.trim() : "";
  const displayName =
    typeof config.config.voiceLabel === "string" && config.config.voiceLabel.trim()
      ? config.config.voiceLabel.trim()
      : modelPath
        ? basenameWithoutExt(modelPath)
        : "Piper Voice";

  if (!modelPath) {
    return [];
  }

  return [
    {
      id: displayName,
      label: displayName,
      providerId: PIPER_PROVIDER_ID,
    },
  ];
};

const synthesizeWithPiper = async (
  outputPath: string,
  request: TtsSynthesisRequest,
  config: TtsProviderConfigRecord,
) => {
  const modelPath =
    typeof config.config.modelPath === "string" ? config.config.modelPath.trim() : "";

  if (!modelPath) {
    throw new Error("Piper modelPath is required.");
  }

  const executablePath = await resolveBundledPiperExecutablePath();

  await fs.access(executablePath);
  await fs.access(modelPath);

  const args = ["--model", modelPath, "--output_file", outputPath];
  if (typeof request.voice === "string" && request.voice.trim()) {
    args.push("--speaker", request.voice.trim());
  } else if (
    typeof config.config.speaker === "string" &&
    config.config.speaker.trim()
  ) {
    args.push("--speaker", config.config.speaker.trim());
  }

  if (typeof config.config.lengthScale === "number") {
    args.push("--length_scale", String(config.config.lengthScale));
  }
  if (typeof config.config.noiseScale === "number") {
    args.push("--noise_scale", String(config.config.noiseScale));
  }
  if (typeof config.config.noiseWScale === "number") {
    args.push("--noise_w", String(config.config.noiseWScale));
  }

  try {
    await runProcess(executablePath, args, {
      stdinText: request.text,
      cwd: path.dirname(executablePath),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Piper synthesis failed";
    if (message.includes("is not a single codepoint")) {
      throw new Error(
        "当前 Piper 语音包不支持这段文本里的英文或拼音片段。请改成纯中文文本后再试。",
      );
    }
    throw error;
  }
};

const resolveApiProviderCatalog = (): ApiProviderCatalog => {
  try {
    const resolved = resolveProviderForRole("voice");
    const connection =
      providerConnectionRepository.findById(resolved.providerConnectionId) ?? null;
    const modelConfig = modelConfigRepository.findDefaultByType("voice");
    const supported = isSupportedApiVoiceProvider(resolved.providerCode);
    const providerDisplayName =
      connection?.displayName || getProviderDefinition(resolved.providerCode).displayName;

    return {
      configured: true,
      supported,
      providerConnectionId: resolved.providerConnectionId,
      providerDisplayName,
      providerCode: resolved.providerCode,
      providerTemplateCode: resolved.providerTemplateCode,
      baseUrl: resolved.baseUrl,
      modelId: resolved.model,
      modelName: modelConfig?.name?.trim() || resolved.model,
      errorMessage: supported
        ? null
        : `${providerDisplayName} 当前没有接入可用于 TTS Studio 的语音合成协议。请把 voice 模型切到支持 OpenAI / OpenAI-compatible speech 的服务商。`,
    };
  } catch (error) {
    return createEmptyApiProviderCatalog(
      error instanceof Error
        ? error.message
        : "当前 voice 模型未配置，无法使用 API 服务商调试。",
    );
  }
};

const synthesizeWithApiProviderVoice = async (
  outputPath: string,
  request: TtsSynthesisRequest,
  providerConfig: TtsProviderConfigRecord,
) => {
  const catalog = resolveApiProviderCatalog();
  if (!catalog.configured) {
    throw new Error(
      catalog.errorMessage || "当前 voice 模型未配置，无法使用 API 服务商调试。",
    );
  }
  if (!catalog.supported || !catalog.providerCode) {
    throw new Error(
      catalog.errorMessage ||
        "当前 voice 模型服务商还没有接入 TTS Studio 的语音合成协议。",
    );
  }

  const resolved = resolveProviderForRole("voice");
  const savedConfig = getApiProviderVoiceConfig(providerConfig.config);
  const voice = (request.voice ?? "").trim() || savedConfig.voice;
  const responseFormat =
    typeof request.responseFormat === "string" &&
    speechResponseMimeTypes[request.responseFormat.trim().toLowerCase()]
      ? request.responseFormat.trim().toLowerCase()
      : savedConfig.responseFormat;
  const speed =
    Number.isFinite(request.speed) && request.speed! >= 0.25 && request.speed! <= 4
      ? request.speed!
      : savedConfig.speed;

  if (!voice) {
    throw new Error("API 服务商音色未配置。请先在 TTS Studio 的 API服务商 配置里填写音色。");
  }

  const isVolcengine = isVolcengineSpeechProvider({
    providerCode: resolved.providerCode,
    providerTemplateCode: resolved.providerTemplateCode,
    baseUrl: resolved.baseUrl,
  });

  if (isVolcengine && unsupportedVolcenginePlaceholderVoices.has(voice.toLowerCase())) {
    throw new Error(
      "火山方舟语音模型需要填写官方音色 ID，不能直接使用 OpenAI 默认音色名，例如 alloy。请在 API服务商 配置里改成方舟文档里的 speaker / 音色 ID。",
    );
  }

  let endpoint = buildOpenAiCompatibleSpeechUrl(resolved.baseUrl);
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  let body: Record<string, unknown> = {
    model: resolved.model,
    input: request.text,
    voice,
    response_format: responseFormat,
    speed,
  };

  if (isVolcengine) {
    const volcengineFormat = mapVolcengineSpeechFormat(responseFormat);
    if (!volcengineFormat) {
      throw new Error(
        "火山方舟语音合成当前不支持 flac 输出。请改成 mp3、wav、pcm 或 opus。",
      );
    }

    endpoint = resolved.baseUrl.trim();
    headers = {
      "Content-Type": "application/json",
      "X-Api-Key": resolved.apiKey.trim(),
      "X-Api-Resource-Id": resolved.model,
      "X-Api-Request-Id": crypto.randomUUID(),
    };
    body = {
      user: {
        uid: "uichat-mira-tts-studio",
      },
      req_params: {
        text: request.text,
        speaker: voice,
        audio_params: {
          format: volcengineFormat,
          sample_rate: resolveVolcengineSampleRate(responseFormat),
        },
      },
    };
  } else if (resolved.apiKey) {
    headers.Authorization = `Bearer ${resolved.apiKey}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    let detail = "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } | string; message?: string }
        | null;
      detail =
        typeof payload?.error === "string"
          ? payload.error
          : payload?.error?.message || payload?.message || "";
    }
    if (!detail) {
      detail = (await response.text().catch(() => "")).trim();
    }
    if (isVolcengine && response.status === 401) {
      throw new Error(
        detail ||
          "火山方舟语音鉴权失败。当前接口要求携带 X-Api-Key 和 X-Api-Resource-Id。",
      );
    }
    throw new Error(
      detail ||
        `API 服务商语音合成失败，HTTP ${response.status}`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = (response.headers.get("content-type") || "").trim().toLowerCase();
  const audioBytes = isVolcengine ? decodeVolcengineChunkedAudio(bytes) : bytes;
  const resolvedMimeType = isVolcengine
    ? getSpeechResponseMimeType(responseFormat, null)
    : getSpeechResponseMimeType(responseFormat, contentType);

  if (!audioBytes.length) {
    throw new Error("API 服务商语音合成返回了空响应，未生成可播放音频。");
  }

  if (!resolvedMimeType.startsWith("audio/") && !isVolcengine) {
    const textPayload = bytes.toString("utf-8").trim();
    const parsedPayload = tryParseJsonObject(textPayload);
    const code =
      typeof parsedPayload?.code === "number" || typeof parsedPayload?.code === "string"
        ? String(parsedPayload.code)
        : "";
    const message =
      typeof parsedPayload?.message === "string" && parsedPayload.message.trim()
        ? parsedPayload.message.trim()
        : textPayload;

    throw new Error(
      message ||
        (code
          ? `API 服务商语音合成返回了非音频响应，错误码 ${code}。`
          : "API 服务商语音合成返回了非音频响应。"),
    );
  }

  await fs.writeFile(outputPath, audioBytes);

  return {
    voice,
    responseFormat,
    speed,
    mimeType: resolvedMimeType,
    providerMeta: {
      providerDisplayName: catalog.providerDisplayName,
      providerCode: catalog.providerCode,
      modelId: catalog.modelId,
      modelName: catalog.modelName,
      endpoint,
    },
  };
};

export const createTtsService = (options?: { artifactRoot?: string }) => {
  const artifactRoot =
    options?.artifactRoot ??
    resolveWorkspacePath(".artifacts", "tts", "outputs");

  return {
    async getOverview(): Promise<TtsOverview> {
      await ensureDir(artifactRoot);
      return {
        providers: ttsProviderConfigsRepository.list(),
        recentJobs: ttsSynthesisJobsRepository.listRecent(20),
      };
    },

    getProvider(providerId: TtsProviderId) {
      return ttsProviderConfigsRepository.getByProviderId(providerId);
    },

    updateProvider(
      providerId: TtsProviderId,
      input: {
        enabled?: boolean;
        displayName?: string;
        config?: Record<string, unknown>;
      },
    ) {
      if (providerId === PIPER_PROVIDER_ID && input.config) {
        validatePiperModelConfig(input.config);
      }
      return ttsProviderConfigsRepository.upsert(providerId, input);
    },

    async listVoices(providerId: TtsProviderId) {
      const provider = ttsProviderConfigsRepository.getByProviderId(providerId);
      if (!provider) {
        return [];
      }

      if (providerId === WINDOWS_PROVIDER_ID) {
        return listWindowsVoices();
      }

      if (providerId === GPT_SOVITS_PROVIDER_ID) {
        return [];
      }

      if (providerId === API_PROVIDER_ID) {
        return [];
      }

      return listPiperVoices(provider);
    },

    async getGptSovitsCatalog(): Promise<GptSovitsCatalog> {
      const provider = ttsProviderConfigsRepository.getByProviderId(GPT_SOVITS_PROVIDER_ID);
      if (!provider) {
        throw new Error("GPT-SoVITS provider config is unavailable.");
      }

      return loadGptSovitsCatalog(provider.config);
    },

    getApiProviderCatalog(): ApiProviderCatalog {
      return resolveApiProviderCatalog();
    },

    getSynthesis(jobId: string) {
      return ttsSynthesisJobsRepository.getById(jobId);
    },

    async synthesize(request: TtsSynthesisRequest) {
      const text = request.text.trim();
      if (!text) {
        throw new Error("Synthesis text is required.");
      }

      await ensureDir(artifactRoot);

      const provider = ttsProviderConfigsRepository.getByProviderId(request.providerId);
      if (!provider || !provider.enabled) {
        throw new Error(`TTS provider is unavailable: ${request.providerId}`);
      }

      if (request.providerId === GPT_SOVITS_PROVIDER_ID) {
        throw new Error("Use the GPT-SoVITS synthesis route for this provider.");
      }
      const isApiProvider = request.providerId === API_PROVIDER_ID;
      const resolvedRequest = isApiProvider
        ? null
        : resolveBaseSynthesisRequest(provider);
      const apiConfig = isApiProvider ? getApiProviderVoiceConfig(provider.config) : null;

      const job = ttsSynthesisJobsRepository.create({
        providerId: request.providerId,
        status: "queued",
        text,
        voice: isApiProvider ? apiConfig?.voice || null : resolvedRequest?.voice || null,
        requestConfig: {
          ...(isApiProvider
            ? {
                voice: apiConfig?.voice || "",
                responseFormat: apiConfig?.responseFormat || "mp3",
                speed: apiConfig?.speed ?? 1,
              }
            : {
                rate: resolvedRequest?.rate ?? 0,
                volume: resolvedRequest?.volume ?? 100,
              }),
        },
      });

      const outputExtension = isApiProvider ? `.${apiConfig?.responseFormat || "mp3"}` : ".wav";
      const outputPath = path.join(artifactRoot, `${job.id}${outputExtension}`);
      ttsSynthesisJobsRepository.markRunning(job.id, outputPath);

      try {
        if (request.providerId === WINDOWS_PROVIDER_ID) {
          await synthesizeWithWindowsVoice(outputPath, {
            providerId: request.providerId,
            text,
            voice: resolvedRequest?.voice ?? undefined,
            rate: resolvedRequest?.rate,
            volume: resolvedRequest?.volume,
          });
        } else if (request.providerId === API_PROVIDER_ID) {
          const result = await synthesizeWithApiProviderVoice(
            outputPath,
            {
              providerId: request.providerId,
              text,
              voice: request.voice,
              speed: request.speed,
              responseFormat: request.responseFormat,
            },
            provider,
          );
          const completed = ttsSynthesisJobsRepository.markSucceeded(job.id, {
            outputPath,
            mimeType: result.mimeType,
          });
          if (!completed) {
            throw new Error(`TTS job was not found after synthesis: ${job.id}`);
          }
          return completed;
        } else {
          await synthesizeWithPiper(
            outputPath,
            {
              providerId: request.providerId,
              text,
              voice: resolvedRequest?.voice ?? undefined,
              rate: resolvedRequest?.rate,
              volume: resolvedRequest?.volume,
            },
            provider,
          );
        }

        const completed = ttsSynthesisJobsRepository.markSucceeded(job.id, {
          outputPath,
          mimeType: "audio/wav",
        });
        if (!completed) {
          throw new Error(`TTS job was not found after synthesis: ${job.id}`);
        }
        return completed;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown TTS synthesis error";
        const failed = ttsSynthesisJobsRepository.markFailed(job.id, message);
        if (failed) {
          return failed;
        }
        throw error;
      }
    },

    async synthesizeGptSovits(
      request: GptSovitsSynthesisRequest,
      upload?: { buffer: Buffer; fileName: string },
    ) {
      const text = request.text.trim();
      if (!text) {
        throw new Error("Synthesis text is required.");
      }

      await ensureDir(artifactRoot);

      const provider = ttsProviderConfigsRepository.getByProviderId(GPT_SOVITS_PROVIDER_ID);
      if (!provider || !provider.enabled) {
        throw new Error(`TTS provider is unavailable: ${GPT_SOVITS_PROVIDER_ID}`);
      }

      let refAudioPath = (request.refAudioPath ?? "").trim();
      if (upload) {
        const storedRefAudio = await ttsRefAudioStorageService.save({
          buffer: upload.buffer,
          originalName: upload.fileName,
        });
        refAudioPath = storedRefAudio.absoluteUrl;
      } else if (refAudioPath.startsWith("/microapps/tts/ref-audios/")) {
        refAudioPath = ttsRefAudioStorageService.resolveAbsoluteUrlFromPublicPath(refAudioPath);
      } else if (refAudioPath && !isHttpUrl(refAudioPath)) {
        const refAudioBuffer = await fs.readFile(refAudioPath);
        const storedRefAudio = await ttsRefAudioStorageService.save({
          buffer: refAudioBuffer,
          originalName: path.basename(refAudioPath),
        });
        refAudioPath = storedRefAudio.absoluteUrl;
      }

      const resolvedRequest = resolveGptSovitsSynthesisRequest(
        provider.config,
        request,
        refAudioPath,
      );
      resolvedRequest.promptText = await rewriteToCantoneseLocalText(
        resolvedRequest.promptText,
        resolvedRequest.promptLanguage,
        "参考文本",
      );
      resolvedRequest.text = await rewriteToCantoneseLocalText(
        resolvedRequest.text,
        resolvedRequest.textLanguage,
        "合成文本",
      );

      const job = ttsSynthesisJobsRepository.create({
        providerId: GPT_SOVITS_PROVIDER_ID,
        status: "queued",
        text: resolvedRequest.text,
        voice: resolvedRequest.sovitsModel || null,
        requestConfig: {
          serviceUrl:
            typeof provider.config.baseUrl === "string" && provider.config.baseUrl.trim()
              ? provider.config.baseUrl.trim()
              : getDefaultGptSovitsServiceUrl(),
          refAudioPath: resolvedRequest.refAudioPath,
          promptText: resolvedRequest.promptText,
          promptLanguage: resolvedRequest.promptLanguage,
          textLanguage: resolvedRequest.textLanguage,
          gptModel: resolvedRequest.gptModel,
          sovitsModel: resolvedRequest.sovitsModel,
          cutMethod: resolvedRequest.cutMethod,
          sampleSteps: resolvedRequest.sampleSteps,
          speed: resolvedRequest.speed,
          pauseSecond: resolvedRequest.pauseSecond,
          temperature: resolvedRequest.temperature,
          topK: resolvedRequest.topK,
          topP: resolvedRequest.topP,
        },
      });

      const outputPath = path.join(artifactRoot, `${job.id}.wav`);
      ttsSynthesisJobsRepository.markRunning(job.id, outputPath);

      try {
        const result = await synthesizeWithGptSovits({
          providerConfig: provider.config,
          request: resolvedRequest,
          outputPath,
        });

        const completed = ttsSynthesisJobsRepository.markSucceeded(job.id, {
          outputPath,
          mimeType: result.mimeType,
        });
        if (!completed) {
          throw new Error(`TTS job was not found after synthesis: ${job.id}`);
        }
        return completed;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown GPT-SoVITS synthesis error";
        const failed = ttsSynthesisJobsRepository.markFailed(job.id, message);
        if (failed) {
          return failed;
        }
        throw error;
      }
    },
  };
};
