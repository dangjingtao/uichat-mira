import path from "node:path";
import ExcelJS from "exceljs";

export type SpreadsheetCellPatch = {
  sheetName: string;
  cell: string;
  value?: string | number | boolean | null;
  formula?: string;
  bold?: boolean;
  numberFormat?: string;
};

export type SpreadsheetPatchInput = {
  fileName: string;
  buffer: Buffer;
  patches: SpreadsheetCellPatch[];
};

export type SpreadsheetPatchArtifact = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  summary: string;
  modifiedSheets: string[];
  modifiedCells: number;
};

export const SPREADSHEET_VERIFICATION_PATCHES: SpreadsheetCellPatch[] = [
  {
    sheetName: "文枢验证",
    cell: "A1",
    value: "文枢 Excel Modify 验证",
    bold: true,
  },
  {
    sheetName: "文枢验证",
    cell: "A2",
    value: "原文件未覆盖，此工作表写入到新的 XLSX 产物。",
  },
  {
    sheetName: "文枢验证",
    cell: "A4",
    value: "项目",
    bold: true,
  },
  {
    sheetName: "文枢验证",
    cell: "B4",
    value: "数量",
    bold: true,
  },
  {
    sheetName: "文枢验证",
    cell: "A5",
    value: "Inspect",
  },
  {
    sheetName: "文枢验证",
    cell: "B5",
    value: 1,
  },
  {
    sheetName: "文枢验证",
    cell: "A6",
    value: "Create",
  },
  {
    sheetName: "文枢验证",
    cell: "B6",
    value: 1,
  },
  {
    sheetName: "文枢验证",
    cell: "A7",
    value: "Modify",
  },
  {
    sheetName: "文枢验证",
    cell: "B7",
    value: 1,
  },
  {
    sheetName: "文枢验证",
    cell: "B8",
    formula: "SUM(B5:B7)",
    bold: true,
    numberFormat: "0",
  },
];

const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const buildOutputFileName = (fileName: string) => {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, extension) || "workbook";
  return `${baseName}-wenshu.xlsx`;
};

export const patchSpreadsheetWorkbook = async (
  input: SpreadsheetPatchInput,
): Promise<SpreadsheetPatchArtifact> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input.buffer);

  const modifiedSheets = new Set<string>();

  for (const patch of input.patches) {
    const sheetName = patch.sheetName.trim();
    const cellAddress = patch.cell.trim().toUpperCase();
    if (!sheetName || !cellAddress) {
      throw new Error("Spreadsheet patch requires sheetName and cell");
    }

    const worksheet = workbook.getWorksheet(sheetName) ?? workbook.addWorksheet(sheetName);
    const cell = worksheet.getCell(cellAddress);

    if (patch.formula) {
      cell.value = { formula: patch.formula };
    } else if (patch.value !== undefined) {
      cell.value = patch.value;
    }

    if (patch.bold !== undefined) {
      cell.font = {
        ...cell.font,
        bold: patch.bold,
      };
    }
    if (patch.numberFormat) {
      cell.numFmt = patch.numberFormat;
    }

    modifiedSheets.add(sheetName);
  }

  const output = await workbook.xlsx.writeBuffer();
  return {
    fileName: buildOutputFileName(input.fileName),
    mimeType: EXCEL_MIME,
    buffer: Buffer.from(output),
    summary: `修改 ${modifiedSheets.size} 个工作表中的 ${input.patches.length} 个单元格，并输出新工作簿。`,
    modifiedSheets: Array.from(modifiedSheets),
    modifiedCells: input.patches.length,
  };
};

export const createSpreadsheetVerificationCopy = async (input: {
  fileName: string;
  buffer: Buffer;
}): Promise<SpreadsheetPatchArtifact> =>
  patchSpreadsheetWorkbook({
    ...input,
    patches: SPREADSHEET_VERIFICATION_PATCHES,
  });
