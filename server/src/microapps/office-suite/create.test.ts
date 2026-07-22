import { describe, expect, it } from "vitest";
import { createOfficeSample } from "./create.js";
import {
  inspectOfficeDocument,
  type OfficeSuiteFileKind,
} from "./index.js";

const cases: Array<{
  kind: OfficeSuiteFileKind;
  extension: ".docx" | ".xlsx" | ".pptx";
}> = [
  { kind: "word", extension: ".docx" },
  { kind: "excel", extension: ".xlsx" },
  { kind: "powerpoint", extension: ".pptx" },
];

describe("office suite create -> inspect roundtrip", () => {
  for (const testCase of cases) {
    it(`creates a readable ${testCase.kind} sample`, async () => {
      const artifact = await createOfficeSample(testCase.kind);

      expect(artifact.kind).toBe(testCase.kind);
      expect(artifact.fileName.endsWith(testCase.extension)).toBe(true);
      expect(artifact.buffer.byteLength).toBeGreaterThan(500);

      const inspection = inspectOfficeDocument({
        fileName: artifact.fileName,
        mimeType: artifact.mimeType,
        buffer: artifact.buffer,
      });

      expect(inspection.kind).toBe(testCase.kind);
      expect(inspection.byteSize).toBe(artifact.buffer.byteLength);
      expect(inspection.previewText.length).toBeGreaterThan(0);
    });
  }
});
