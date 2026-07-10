import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, test, vi } from "vitest";
import { resetDatabaseClients } from "@/db/index.js";
import { ttsProviderConfigsRepository } from "@/db/repositories/tts-provider-configs.repository.js";
import { ttsSynthesisJobsRepository } from "@/db/repositories/tts-synthesis-jobs.repository.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";

const synthesizeWithGptSovitsMock = vi.fn();

vi.mock("./gpt-sovits-gradio.js", async () => ({
  getDefaultGptSovitsServiceUrl: () => "http://127.0.0.1:9872",
  loadGptSovitsCatalog: vi.fn(),
  synthesizeWithGptSovits: synthesizeWithGptSovitsMock,
}));

const testDbPath = createTimestampedTestArtifactPath(
  "db",
  "rag-demo-tts-gpt-sovits",
  ".sqlite",
);
const artifactRoot = createTimestampedTestArtifactPath(
  "server",
  "rag-demo-tts-gpt-sovits-output",
);
const refAudioPath = createTimestampedTestArtifactPath(
  "server",
  "rag-demo-tts-gpt-sovits-ref",
  ".wav",
);

process.env.DATABASE_URL = `file:${testDbPath}`;

const { createTtsService } = await import("./index.js");

beforeEach(() => {
  resetDatabaseClients();
  fs.rmSync(testDbPath, { force: true });
  fs.rmSync(`${testDbPath}-wal`, { force: true });
  fs.rmSync(`${testDbPath}-shm`, { force: true });
  fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
  fs.mkdirSync(path.dirname(artifactRoot), { recursive: true });
  fs.writeFileSync(refAudioPath, Buffer.from("RIFF"));
  ttsProviderConfigsRepository.initialize();
  ttsSynthesisJobsRepository.initialize();
  synthesizeWithGptSovitsMock.mockReset();
  synthesizeWithGptSovitsMock.mockResolvedValue({
    mimeType: "audio/wav",
    providerMeta: {
      serviceUrl: "http://127.0.0.1:9872",
      sourcePath: null,
    },
  });
});

afterAll(() => {
  resetDatabaseClients();
  fs.rmSync(testDbPath, { force: true });
  fs.rmSync(`${testDbPath}-wal`, { force: true });
  fs.rmSync(`${testDbPath}-shm`, { force: true });
  fs.rmSync(refAudioPath, { force: true });
  fs.rmSync(path.dirname(artifactRoot), { recursive: true, force: true });
});

test("synthesizeGptSovits merges saved provider config into sparse request payload", async () => {
  ttsProviderConfigsRepository.upsert("gpt_sovits", {
    enabled: true,
    displayName: "GPT-SoVITS",
    config: {
      baseUrl: "http://127.0.0.1:9872",
      promptText: "保存的参考文本",
      promptLanguage: "中文",
      textLanguage: "中文",
      gptModel: "不训练直接推v2底模！",
      sovitsModel: "不训练直接推v2ProPlus底模！",
      cutMethod: "凑四句一切",
      sampleSteps: 8,
      speed: 1.1,
      pauseSecond: 0.3,
      temperature: 0,
      topK: 20,
      topP: 0,
    },
  });

  const service = createTtsService({ artifactRoot });
  const job = await service.synthesizeGptSovits({
    text: "你好",
    refAudioPath,
    promptText: "",
    promptLanguage: "",
    textLanguage: "",
    gptModel: "",
    sovitsModel: "",
    cutMethod: "",
    sampleSteps: Number.NaN,
    speed: Number.NaN,
    pauseSecond: Number.NaN,
    temperature: Number.NaN,
    topK: Number.NaN,
    topP: Number.NaN,
  });

  assert.equal(synthesizeWithGptSovitsMock.mock.calls.length, 1);
  const [input] = synthesizeWithGptSovitsMock.mock.calls[0] as Array<[{
    providerConfig: Record<string, unknown>;
    request: Record<string, unknown>;
    outputPath: string;
  }]>;

  assert.equal(input.request.gptModel, "不训练直接推v2底模！");
  assert.equal(input.request.sovitsModel, "不训练直接推v2ProPlus底模！");
  assert.equal(input.request.promptLanguage, "中文");
  assert.equal(input.request.textLanguage, "中文");
  assert.equal(input.request.cutMethod, "凑四句一切");
  assert.equal(input.request.sampleSteps, 8);
  assert.equal(input.request.speed, 1.1);
  assert.equal(input.request.pauseSecond, 0.3);
  assert.equal(input.request.temperature, 0);
  assert.equal(input.request.topK, 20);
  assert.equal(input.request.topP, 0);
  assert.equal(job.requestConfig.gptModel, "不训练直接推v2底模！");
  assert.equal(job.requestConfig.sovitsModel, "不训练直接推v2ProPlus底模！");
  assert.equal(job.requestConfig.temperature, 0);
  assert.equal(job.requestConfig.topP, 0);
});

test("synthesizeGptSovits stores uploaded ref audio under backend static route", async () => {
  ttsProviderConfigsRepository.upsert("gpt_sovits", {
    enabled: true,
    displayName: "GPT-SoVITS",
    config: {
      baseUrl: "http://127.0.0.1:9872",
      promptText: "",
      promptLanguage: "中文",
      textLanguage: "中文",
      gptModel: "不训练直接推v2底模！",
      sovitsModel: "不训练直接推v2ProPlus底模！",
      cutMethod: "凑四句一切",
      sampleSteps: 8,
      speed: 1,
      pauseSecond: 0.3,
      temperature: 1,
      topK: 15,
      topP: 1,
    },
  });

  const service = createTtsService({ artifactRoot });
  const job = await service.synthesizeGptSovits(
    {
      text: "你好",
      refAudioPath: "",
      promptText: "",
      promptLanguage: "",
      textLanguage: "",
      gptModel: "",
      sovitsModel: "",
      cutMethod: "",
      sampleSteps: Number.NaN,
      speed: Number.NaN,
      pauseSecond: Number.NaN,
      temperature: Number.NaN,
      topK: Number.NaN,
      topP: Number.NaN,
    },
    {
      buffer: Buffer.from("RIFF-upload"),
      fileName: "demo.wav",
    },
  );

  assert.equal(synthesizeWithGptSovitsMock.mock.calls.length, 1);
  const [input] = synthesizeWithGptSovitsMock.mock.calls[0] as Array<[{
    providerConfig: Record<string, unknown>;
    request: Record<string, unknown>;
    outputPath: string;
  }]>;

  assert.match(
    String(input.request.refAudioPath),
    /^http:\/\/127\.0\.0\.1:8787\/microapps\/tts\/ref-audios\//u,
  );
  assert.equal(job.requestConfig.serviceUrl, "http://127.0.0.1:9872");
  assert.match(
    String(job.requestConfig.refAudioPath),
    /^http:\/\/127\.0\.0\.1:8787\/microapps\/tts\/ref-audios\//u,
  );
});
