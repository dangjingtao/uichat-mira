import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { createOfficeSample } from "./create.js";
import { inspectOfficeDocument, type OfficeSuiteFileKind } from "./index.js";
import { createSpreadsheetVerificationCopy } from "./spreadsheet.js";

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

  it("modifies an existing xlsx into a new verification copy", async () => {
    const source = await createOfficeSample("excel");
    const modified = await createSpreadsheetVerificationCopy({
      fileName: source.fileName,
      buffer: source.buffer,
    });

    expect(modified.fileName).toBe("wenshu-excel-sample-wenshu.xlsx");
    expect(modified.buffer.byteLength).toBeGreaterThan(512);
    expect(modified.modifiedSheets).toContain("文枢验证");
    expect(modified.modifiedCells).toBeGreaterThanOrEqual(3);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(modified.buffer);
    const verificationSheet = workbook.getWorksheet("文枢验证");

    expect(verificationSheet).toBeDefined();
    expect(verificationSheet?.getCell("A1").value).toBe("文枢 Excel Modify 验证");
    expect(verificationSheet?.getCell("A1").font.bold).toBe(true);
    expect(verificationSheet?.getCell("B8").formula).toBe("SUM(B5:B7)");

    const inspection = inspectOfficeDocument({
      fileName: modified.fileName,
      mimeType: modified.mimeType,
      buffer: modified.buffer,
    });
    const sheets = inspection.structure.sheets as Array<{ name: string }>;

    expect(inspection.kind).toBe("excel");
    expect(sheets.some((sheet) => sheet.name === "文枢验证")).toBe(true);
  });
});
