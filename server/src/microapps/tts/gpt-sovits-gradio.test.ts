import assert from "node:assert/strict";
import { test } from "vitest";
import { applyGptSovitsOutputGain } from "./gpt-sovits-gradio.js";

const createPcm16Wav = (samples: number[]) => {
  const sampleCount = samples.length;
  const dataSize = sampleCount * 2;
  const byteRate = 32000 * 2;
  const blockAlign = 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(32000, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(samples[index] ?? 0, 44 + index * 2);
  }

  return buffer;
};

test("applyGptSovitsOutputGain boosts quiet pcm16 wav output", () => {
  const input = createPcm16Wav([2000, -2000, 1200, -1200]);
  const output = applyGptSovitsOutputGain(input, "audio/wav");

  assert.notStrictEqual(output, input);
  assert.equal(output.length, input.length);
  assert.ok(Math.abs(output.readInt16LE(44)) > Math.abs(input.readInt16LE(44)));
  assert.ok(Math.abs(output.readInt16LE(46)) > Math.abs(input.readInt16LE(46)));
});

test("applyGptSovitsOutputGain leaves near-full-scale pcm16 wav unchanged", () => {
  const input = createPcm16Wav([30000, -30000, 22000, -22000]);
  const output = applyGptSovitsOutputGain(input, "audio/wav");

  assert.strictEqual(output, input);
});

test("applyGptSovitsOutputGain ignores non-wav bytes", () => {
  const input = Buffer.from("not-a-wav");
  const output = applyGptSovitsOutputGain(input, "audio/mpeg");

  assert.strictEqual(output, input);
});
