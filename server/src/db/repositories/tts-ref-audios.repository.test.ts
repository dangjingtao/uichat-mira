import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { ttsRefAudiosRepository } from "./tts-ref-audios.repository.js";

describe("ttsRefAudiosRepository", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath(
      "db",
      "tts-ref-audios",
      ".sqlite",
    )}`;
    resetDatabaseClients();
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("deduplicates identical WAV bytes and serves the stored blob", () => {
    const bytes = Buffer.from("RIFF-test-wav");
    const first = ttsRefAudiosRepository.saveOrGet({
      buffer: bytes,
      originalName: "voice.wav",
      mimeType: "audio/wav",
    });
    const second = ttsRefAudiosRepository.saveOrGet({
      buffer: bytes,
      originalName: "voice-copy.wav",
      mimeType: "audio/wav",
    });

    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
    expect(second.summary.id).toBe(first.summary.id);
    expect(Buffer.from(ttsRefAudiosRepository.getById(first.summary.id)!.audioBlob)).toEqual(bytes);
    expect(
      getSqlite()
        .prepare("SELECT COUNT(*) AS count FROM tts_ref_audios")
        .get(),
    ).toEqual({ count: 1 });
  });
});
