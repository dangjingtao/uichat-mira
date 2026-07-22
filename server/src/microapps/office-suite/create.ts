import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";
import ExcelJS from "exceljs";
import PptxGenJS from "pptxgenjs";
import type { OfficeSuiteFileKind } from "./index.js";

export type OfficeSuiteCreatedArtifact = {
  kind: OfficeSuiteFileKind;
  fileName: string;
  mimeType: string;
  summary: string;
  buffer: Buffer;
};

const createWordSample = async (): Promise<OfficeSuiteCreatedArtifact> => {
  const document = new Document({
    creator: "UIChat Mira",
    title: "文枢 Office Runtime 测试文档",
    description: "用于验证文枢 Word Create 链路。",
    sections: [
      {
        children: [
          new Paragraph({
            text: "文枢",
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Office Runtime · Word Create 链路测试",
                bold: true,
              }),
            ],
          }),
          new Paragraph(
            "这个文件由 Mira 的文枢微应用生成，用于验证 DOCX 创建、下载与再次读取链路。",
          ),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("能力")] }),
                  new TableCell({ children: [new Paragraph("状态")] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Word Create")] }),
                  new TableCell({
                    children: [new Paragraph("Ready for verification")],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return {
    kind: "word",
    fileName: "wenshu-word-sample.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    summary: "使用 docx 生成包含标题、段落和表格的 DOCX 测试产物。",
    buffer: await Packer.toBuffer(document),
  };
};

const createExcelSample = async (): Promise<OfficeSuiteCreatedArtifact> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "UIChat Mira";
  workbook.title = "文枢 Office Runtime 测试工作簿";
  workbook.subject = "用于验证文枢 Excel Create 链路";

  const sheet = workbook.addWorksheet("文枢测试");
  sheet.columns = [
    { header: "能力", key: "capability", width: 24 },
    { header: "状态", key: "status", width: 24 },
    { header: "说明", key: "note", width: 48 },
  ];
  sheet.addRows([
    {
      capability: "Excel Create",
      status: "Ready for verification",
      note: "由 exceljs 生成并通过文枢下载。",
    },
    {
      capability: "Excel Inspect",
      status: "Available",
      note: "下载后可重新上传到文枢验证读取链路。",
    },
  ]);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const output = await workbook.xlsx.writeBuffer();
  return {
    kind: "excel",
    fileName: "wenshu-excel-sample.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    summary: "使用 exceljs 生成包含表头、数据和基础样式的 XLSX 测试产物。",
    buffer: Buffer.from(output),
  };
};

const toNodeBuffer = (output: unknown): Buffer => {
  if (Buffer.isBuffer(output)) {
    return output;
  }
  if (output instanceof Uint8Array) {
    return Buffer.from(output);
  }
  if (output instanceof ArrayBuffer) {
    return Buffer.from(output);
  }
  throw new Error("PowerPoint generation did not return a Node binary buffer");
};

const POWERPOINT_SAMPLE_PNG =
  "image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAQCAIAAAD4YuoOAAAAJ0lEQVR42mO4We6KB+lrqVGIGEYtGPEWfP/ynkI0asGoBaMW0MECAFpdsiJns2fbAAAAAElFTkSuQmCC";

const createPowerPointSample = async (): Promise<OfficeSuiteCreatedArtifact> => {
  const presentation = new PptxGenJS();
  presentation.layout = "LAYOUT_WIDE";
  presentation.author = "UIChat Mira";
  presentation.subject = "用于验证文枢 PowerPoint Create 链路";
  presentation.title = "文枢 Office Runtime 测试演示文稿";

  const titleSlide = presentation.addSlide();
  titleSlide.addText("文枢", {
    x: 0.8,
    y: 0.75,
    w: 11.7,
    h: 0.7,
    fontSize: 32,
    bold: true,
    margin: 0,
  });
  titleSlide.addText("Office Runtime · PowerPoint Create 链路测试", {
    x: 0.8,
    y: 1.7,
    w: 11.7,
    h: 0.5,
    fontSize: 20,
    margin: 0,
  });
  titleSlide.addText(
    "多页 · 文本 · 图片 · 表格结构\n生成后可重新上传到文枢执行 Inspect 回读。",
    {
      x: 0.8,
      y: 2.65,
      w: 8.5,
      h: 1.2,
      fontSize: 16,
      margin: 0,
    },
  );

  const tableSlide = presentation.addSlide();
  tableSlide.addText("Runtime 验证矩阵", {
    x: 0.8,
    y: 0.55,
    w: 11.7,
    h: 0.55,
    fontSize: 26,
    bold: true,
    margin: 0,
  });
  tableSlide.addTable(
    [
      ["模块", "Inspect", "Create", "Modify"],
      ["Word", "Ready", "Ready", "Basic"],
      ["Excel", "Ready", "Ready", "Basic"],
      ["PowerPoint", "Ready", "Ready", "Not promised"],
    ],
    {
      x: 0.8,
      y: 1.45,
      w: 10.8,
      h: 3.35,
      border: { type: "solid", pt: 1, color: "CFC8C0" },
      fontSize: 16,
      margin: 0.08,
    },
  );

  const imageSlide = presentation.addSlide();
  imageSlide.addText("图片资源验证", {
    x: 0.8,
    y: 0.55,
    w: 11.7,
    h: 0.55,
    fontSize: 26,
    bold: true,
    margin: 0,
  });
  imageSlide.addImage({
    data: POWERPOINT_SAMPLE_PNG,
    x: 0.8,
    y: 1.45,
    w: 6.6,
    h: 3.3,
  });
  imageSlide.addText(
    "这张内嵌 PNG 图片用于验证 PPTX 的媒体资源写入与再次解析，不依赖外部文件或网络。",
    {
      x: 7.8,
      y: 1.7,
      w: 4.6,
      h: 1.8,
      fontSize: 17,
      margin: 0,
    },
  );

  const output = await presentation.stream();
  return {
    kind: "powerpoint",
    fileName: "wenshu-powerpoint-sample.pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    summary: "使用 PptxGenJS 生成包含多页、文本、表格和图片的 PPTX 测试产物。",
    buffer: toNodeBuffer(output),
  };
};

export const createOfficeSample = async (
  kind: OfficeSuiteFileKind,
): Promise<OfficeSuiteCreatedArtifact> => {
  if (kind === "word") {
    return createWordSample();
  }
  if (kind === "excel") {
    return createExcelSample();
  }
  return createPowerPointSample();
};
