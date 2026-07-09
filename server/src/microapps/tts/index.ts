import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import {
  ttsProviderConfigsRepository,
  type TtsProviderConfigRecord,
} from "@/db/repositories/tts-provider-configs.repository.js";
import {
  ttsSynthesisJobsRepository,
  type TtsSynthesisJobRecord,
} from "@/db/repositories/tts-synthesis-jobs.repository.js";
import {
  getDefaultGptSovitsServiceUrl,
  loadGptSovitsCatalog,
  synthesizeWithGptSovits,
  type GptSovitsCatalog,
  type GptSovitsSynthesisRequest,
} from "./gpt-sovits-gradio.js";
export type {
  GptSovitsCatalog,
  GptSovitsSynthesisRequest,
} from "./gpt-sovits-gradio.js";

export type TtsProviderId = "windows_builtin" | "piper_local" | "gpt_sovits";
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
};

export type TtsOverview = {
  providers: TtsProviderConfigRecord[];
  recentJobs: TtsSynthesisJobRecord[];
};

export type TtsService = ReturnType<typeof createTtsService>;

const WINDOWS_PROVIDER_ID: TtsProviderId = "windows_builtin";
const PIPER_PROVIDER_ID: TtsProviderId = "piper_local";
const GPT_SOVITS_PROVIDER_ID: TtsProviderId = "gpt_sovits";

const nowIso = () => new Date().toISOString();

const ensureDir = async (targetPath: string) => {
  await fs.mkdir(targetPath, { recursive: true });
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

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const basenameWithoutExt = (filePath: string) =>
  path.basename(filePath, path.extname(filePath));

const resolveBundledPiperExecutablePath = async () => {
  const processWithResourcesPath = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  const candidates = [
    process.env.UIC_TTS_PIPER_EXECUTABLE,
    path.resolve(process.cwd(), "vendor", "piper", "piper.exe"),
    path.resolve(process.cwd(), ".artifacts", "runtimes", "piper", "piper.exe"),
    path.resolve(path.dirname(process.execPath), "..", "piper", "piper.exe"),
    processWithResourcesPath.resourcesPath
      ? path.resolve(processWithResourcesPath.resourcesPath, "piper", "piper.exe")
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
    "Bundled Piper runtime was not found. Expected piper.exe in the managed runtime directory.",
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
  const configuredExecutablePath =
    typeof config.config.executablePath === "string"
      ? config.config.executablePath.trim()
      : "";
  const modelPath =
    typeof config.config.modelPath === "string" ? config.config.modelPath.trim() : "";

  if (!modelPath) {
    throw new Error("Piper modelPath is required.");
  }

  const executablePath =
    configuredExecutablePath || (await resolveBundledPiperExecutablePath());

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

  await runProcess(executablePath, args, {
    stdinText: request.text,
    cwd: path.dirname(executablePath),
  });
};

export const createTtsService = (options?: { artifactRoot?: string }) => {
  const artifactRoot =
    options?.artifactRoot ??
    path.resolve(process.cwd(), ".artifacts", "tts", "outputs");
  const inputRoot = path.resolve(path.dirname(artifactRoot), "inputs");

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

      return listPiperVoices(provider);
    },

    async getGptSovitsCatalog(): Promise<GptSovitsCatalog> {
      const provider = ttsProviderConfigsRepository.getByProviderId(GPT_SOVITS_PROVIDER_ID);
      if (!provider) {
        throw new Error("GPT-SoVITS provider config is unavailable.");
      }

      return loadGptSovitsCatalog(provider.config);
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

      const job = ttsSynthesisJobsRepository.create({
        providerId: request.providerId,
        status: "queued",
        text,
        voice: request.voice?.trim() || null,
        requestConfig: {
          rate: request.rate ?? 0,
          volume: request.volume ?? 100,
        },
      });

      const outputPath = path.join(artifactRoot, `${job.id}.wav`);
      ttsSynthesisJobsRepository.markRunning(job.id, outputPath);

      try {
        if (request.providerId === WINDOWS_PROVIDER_ID) {
          await synthesizeWithWindowsVoice(outputPath, { ...request, text });
        } else {
          await synthesizeWithPiper(outputPath, { ...request, text }, provider);
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
      await ensureDir(inputRoot);

      const provider = ttsProviderConfigsRepository.getByProviderId(GPT_SOVITS_PROVIDER_ID);
      if (!provider || !provider.enabled) {
        throw new Error(`TTS provider is unavailable: ${GPT_SOVITS_PROVIDER_ID}`);
      }

      let refAudioPath = (request.refAudioPath ?? "").trim();
      let temporaryUploadPath = "";
      if (upload) {
        const fileExt = path.extname(upload.fileName || "").trim().toLowerCase() || ".wav";
        temporaryUploadPath = path.join(
          inputRoot,
          `${Date.now()}-${crypto.randomUUID()}${fileExt === ".wav" ? fileExt : ".wav"}`,
        );
        await fs.writeFile(temporaryUploadPath, upload.buffer);
        refAudioPath = temporaryUploadPath;
      }

      const job = ttsSynthesisJobsRepository.create({
        providerId: GPT_SOVITS_PROVIDER_ID,
        status: "queued",
        text,
        voice: request.sovitsModel.trim() || null,
        requestConfig: {
          serviceUrl:
            typeof provider.config.baseUrl === "string" && provider.config.baseUrl.trim()
              ? provider.config.baseUrl.trim()
              : getDefaultGptSovitsServiceUrl(),
          refAudioPath,
          promptText: request.promptText,
          promptLanguage: request.promptLanguage,
          textLanguage: request.textLanguage,
          gptModel: request.gptModel,
          sovitsModel: request.sovitsModel,
          cutMethod: request.cutMethod,
          sampleSteps: request.sampleSteps,
          speed: request.speed,
          pauseSecond: request.pauseSecond,
          temperature: request.temperature,
          topK: request.topK,
          topP: request.topP,
        },
      });

      const outputPath = path.join(artifactRoot, `${job.id}.wav`);
      ttsSynthesisJobsRepository.markRunning(job.id, outputPath);

      try {
        const result = await synthesizeWithGptSovits({
          providerConfig: provider.config,
          request: { ...request, text, refAudioPath },
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
      } finally {
        if (temporaryUploadPath) {
          await fs.rm(temporaryUploadPath, { force: true }).catch(() => undefined);
        }
      }
    },
  };
};
