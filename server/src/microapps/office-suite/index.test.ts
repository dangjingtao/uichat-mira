import AdmZip from "adm-zip";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { createOfficeSample } from "./create.js";
import { createDocumentVerificationCopy } from "./document.js";
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

  it("modifies an existing docx into a new verification copy", async () => {
    const source = await createOfficeSample("word");
    const sourceInspection = inspectOfficeDocument({
      fileName: source.fileName,
      mimeType: source.mimeType,
      buffer: source.buffer,
    });
    const modified = createDocumentVerificationCopy({
      fileName: source.fileName,
      buffer: source.buffer,
    });

    expect(modified.fileName).toBe("wenshu-word-sample-wenshu.docx");
    expect(modified.buffer.byteLength).toBeGreaterThan(512);

    const modifiedInspection = inspectOfficeDocument({
      fileName: modified.fileName,
      mimeType: modified.mimeType,
      buffer: modified.buffer,
    });

    expect(modifiedInspection.kind).toBe("word");
    expect(modifiedInspection.previewText).toContain("文枢 Word Modify 验证");
    expect(Number(modifiedInspection.structure.paragraphs)).toBeGreaterThan(
      Number(sourceInspection.structure.paragraphs),
    );

    const archive = new AdmZip(modified.buffer);
    const documentXml = archive
      .getEntry("word/document.xml")
      ?.getData()
      .toString("utf8");
    expect(documentXml).toBeTruthy();

    const appendedIndex = documentXml?.lastIndexOf("文枢 Word Modify 验证") ?? -1;
    const sectionIndex = documentXml?.lastIndexOf("<w:sectPr") ?? -1;
    expect(appendedIndex).toBeGreaterThan(-1);
    if (sectionIndex >= 0) {
      expect(appendedIndex).toBeLessThan(sectionIndex);
    }
  });

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

  it("creates a multi-slide pptx with media and a structured table", async () => {
    const artifact = await createOfficeSample("powerpoint");
    const inspection = inspectOfficeDocument({
      fileName: artifact.fileName,
      mimeType: artifact.mimeType,
      buffer: artifact.buffer,
    });
    const slides = inspection.structure.slides as Array<{
      index: number;
      images: number;
      tables: number;
    }>;
    const totals = inspection.structure.totals as {
      images: number;
      tables: number;
    };

    expect(slides.length).toBeGreaterThanOrEqual(3);
    expect(Number(inspection.structure.media)).toBeGreaterThanOrEqual(1);
    expect(totals.images).toBeGreaterThanOrEqual(1);
    expect(totals.tables).toBeGreaterThanOrEqual(1);
    expect(slides.some((slide) => slide.images > 0)).toBe(true);
    expect(slides.some((slide) => slide.tables > 0)).toBe(true);
  });
});
