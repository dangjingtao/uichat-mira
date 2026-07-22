import path from "node:path";
import AdmZip from "adm-zip";
import * as XLSX from "xlsx";

export type OfficeSuiteFileKind = "word" | "excel" | "powerpoint";

export type OfficeSuiteInspection = {
  kind: OfficeSuiteFileKind;
  fileName: string;
  extension: string;
  mimeType: string;
  byteSize: number;
  summary: string;
  previewText: string;
  structure: Record<string, unknown>;
};

export class UnsupportedOfficeFileError extends Error {
  constructor(extension: string) {
    super(`Unsupported Office file type: ${extension || "unknown"}`);
    this.name = "UnsupportedOfficeFileError";
  }
}

type InspectOfficeDocumentInput = {
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
};

const decodeXmlText = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );

const extractTagText = (xml: string, tagName: string) => {
  const pattern = new RegExp(
    `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
    "g",
  );
  return Array.from(xml.matchAll(pattern), (match) =>
    decodeXmlText(match[1] ?? "").replace(/\s+/g, " ").trim(),
  ).filter(Boolean);
};

const clipPreview = (value: string, maxLength = 8_000) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength)}\n…`;

const inspectWordDocument = (
  input: InspectOfficeDocumentInput,
  extension: string,
): OfficeSuiteInspection => {
  const archive = new AdmZip(input.buffer);
  const documentEntry = archive.getEntry("word/document.xml");
  if (!documentEntry) {
    throw new Error("Invalid DOCX file: word/document.xml is missing");
  }

  const documentXml = documentEntry.getData().toString("utf8");
  const paragraphBlocks = Array.from(
    documentXml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g),
    (match) => match[1] ?? "",
  );
  const paragraphs = paragraphBlocks
    .map((paragraph) => extractTagText(paragraph, "w:t").join(""))
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const tableCount = (documentXml.match(/<w:tbl(?:\s|>)/g) ?? []).length;
  const mediaCount = archive
    .getEntries()
    .filter(
      (entry) => entry.entryName.startsWith("word/media/") && !entry.isDirectory,
    ).length;

  return {
    kind: "word",
    fileName: input.fileName,
    extension,
    mimeType:
      input.mimeType ||
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    byteSize: input.buffer.byteLength,
    summary: `${paragraphs.length} 个文本段落 · ${tableCount} 个表格 · ${mediaCount} 个媒体资源`,
    previewText: clipPreview(paragraphs.join("\n\n")),
    structure: {
      paragraphs: paragraphs.length,
      tables: tableCount,
      media: mediaCount,
      hasHeaders: archive
        .getEntries()
        .some((entry) => /^word\/header\d+\.xml$/.test(entry.entryName)),
      hasFooters: archive
        .getEntries()
        .some((entry) => /^word\/footer\d+\.xml$/.test(entry.entryName)),
    },
  };
};

const inspectExcelWorkbook = (
  input: InspectOfficeDocumentInput,
  extension: string,
): OfficeSuiteInspection => {
  const workbook = XLSX.read(input.buffer, {
    type: "buffer",
    cellDates: true,
  });

  const sheets = workbook.SheetNames.map((name, index) => {
    const worksheet = workbook.Sheets[name];
    const ref = worksheet?.["!ref"];
    const range = ref ? XLSX.utils.decode_range(ref) : null;
    const rows = range ? range.e.r - range.s.r + 1 : 0;
    const columns = range ? range.e.c - range.s.c + 1 : 0;
    const hiddenState = workbook.Workbook?.Sheets?.[index]?.Hidden ?? 0;
    return {
      name,
      ref: ref ?? null,
      rows,
      columns,
      hidden: hiddenState !== 0,
    };
  });

  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
  const previewRows = firstSheet
    ? (XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        raw: false,
        blankrows: false,
        defval: "",
      }) as unknown[][])
    : [];
  const previewText = previewRows
    .slice(0, 20)
    .map((row) =>
      row
        .slice(0, 12)
        .map((cell) => String(cell ?? ""))
        .join("\t"),
    )
    .join("\n");

  return {
    kind: "excel",
    fileName: input.fileName,
    extension,
    mimeType:
      input.mimeType ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    byteSize: input.buffer.byteLength,
    summary: `${sheets.length} 个工作表 · ${sheets.reduce((total, sheet) => total + sheet.rows, 0)} 行数据范围`,
    previewText: clipPreview(previewText),
    structure: {
      sheets,
      definedNames: workbook.Workbook?.Names?.length ?? 0,
    },
  };
};

const inspectPowerPointPresentation = (
  input: InspectOfficeDocumentInput,
  extension: string,
): OfficeSuiteInspection => {
  const archive = new AdmZip(input.buffer);
  const slideEntries = archive
    .getEntries()
    .flatMap((entry) => {
      const match = entry.entryName.match(/^ppt\/slides\/slide(\d+)\.xml$/);
      return match ? [{ entry, index: Number(match[1]) }] : [];
    })
    .sort((left, right) => left.index - right.index);

  if (slideEntries.length === 0) {
    throw new Error("Invalid PPTX file: no slide XML was found");
  }

  const slides = slideEntries.map(({ entry, index }) => {
    const xml = entry.getData().toString("utf8");
    const texts = extractTagText(xml, "a:t");
    return {
      index,
      text: texts.join(" "),
      textItems: texts.length,
    };
  });
  const mediaCount = archive
    .getEntries()
    .filter(
      (entry) => entry.entryName.startsWith("ppt/media/") && !entry.isDirectory,
    ).length;

  return {
    kind: "powerpoint",
    fileName: input.fileName,
    extension,
    mimeType:
      input.mimeType ||
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    byteSize: input.buffer.byteLength,
    summary: `${slides.length} 页幻灯片 · ${mediaCount} 个媒体资源`,
    previewText: clipPreview(
      slides
        .map((slide) => `# ${slide.index}\n${slide.text}`)
        .filter(Boolean)
        .join("\n\n"),
    ),
    structure: {
      slides: slides.map((slide) => ({
        index: slide.index,
        textItems: slide.textItems,
        textPreview: clipPreview(slide.text, 240),
      })),
      media: mediaCount,
      notes: archive
        .getEntries()
        .filter((entry) =>
          /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(entry.entryName),
        ).length,
    },
  };
};

export const inspectOfficeDocument = (
  input: InspectOfficeDocumentInput,
): OfficeSuiteInspection => {
  const extension = path.extname(input.fileName).toLowerCase();

  if (extension === ".docx") {
    return inspectWordDocument(input, extension);
  }
  if (extension === ".xlsx" || extension === ".xls") {
    return inspectExcelWorkbook(input, extension);
  }
  if (extension === ".pptx") {
    return inspectPowerPointPresentation(input, extension);
  }

  throw new UnsupportedOfficeFileError(extension);
};
