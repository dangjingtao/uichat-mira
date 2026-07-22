import { describe, expect, it } from "vitest";
import { createOfficeSample } from "./create.js";
import { inspectOfficeDocument, type OfficeSuiteFileKind } from "./index.js";

const CASES: OfficeSuiteFileKind[] = ["word", "excel", "powerpoint"];

describe("WenShu Office Runtime", () => {
  for (const kind of CASES) {
    it(`creates and re-inspects a ${kind} sample`, async () => {
      const artifact = await createOfficeSample(kind);

      expect(artifact.kind).toBe(kind);
      expect(artifact.buffer.byteLength).toBeGreaterThan(512);

      const inspection = inspectOfficeDocument({
        fileName: artifact.fileName,
        mimeType: artifact.mimeType,
        buffer: artifact.buffer,
      });

      expect(inspection.kind).toBe(kind);
      expect(inspection.byteSize).toBe(artifact.buffer.byteLength);
      expect(inspection.previewText.length).toBeGreaterThan(0);
    });
  }
});
