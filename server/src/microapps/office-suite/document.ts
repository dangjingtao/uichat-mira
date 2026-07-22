import path from "node:path";
import AdmZip from "adm-zip";

export type DocumentAppendArtifact = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  summary: string;
};

const WORD_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildOutputFileName = (fileName: string) => {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, extension) || "document";
  return `${baseName}-wenshu.docx`;
};

const resolveBodyInsertIndex = (documentXml: string, bodyCloseIndex: number) => {
  const bodyContent = documentXml.slice(0, bodyCloseIndex);
  const sectionProperties = bodyContent.match(
    /<w:sectPr(?:\s[^>]*)?(?:\/>|>[\s\S]*?<\/w:sectPr>)\s*$/,
  );

  return sectionProperties?.index ?? bodyCloseIndex;
};

export const appendDocumentParagraphs = (input: {
  fileName: string;
  buffer: Buffer;
  paragraphs: Array<{ text: string; bold?: boolean }>;
}): DocumentAppendArtifact => {
  const archive = new AdmZip(input.buffer);
  const documentEntry = archive.getEntry("word/document.xml");
  if (!documentEntry) {
    throw new Error("Invalid DOCX file: word/document.xml is missing");
  }

  const documentXml = documentEntry.getData().toString("utf8");
  const bodyCloseIndex = documentXml.lastIndexOf("</w:body>");
  if (bodyCloseIndex < 0) {
    throw new Error("Invalid DOCX file: document body is missing");
  }

  const appendedXml = input.paragraphs
    .map(({ text, bold }) => {
      const runProperties = bold ? "<w:rPr><w:b/></w:rPr>" : "";
      return `<w:p><w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
    })
    .join("");
  const insertIndex = resolveBodyInsertIndex(documentXml, bodyCloseIndex);

  const updatedXml = `${documentXml.slice(0, insertIndex)}${appendedXml}${documentXml.slice(insertIndex)}`;
  archive.updateFile("word/document.xml", Buffer.from(updatedXml, "utf8"));

  return {
    fileName: buildOutputFileName(input.fileName),
    mimeType: WORD_MIME,
    buffer: archive.toBuffer(),
    summary: `向文档尾部追加 ${input.paragraphs.length} 个段落，并输出新的 DOCX 副本。`,
  };
};

export const createDocumentVerificationCopy = (input: {
  fileName: string;
  buffer: Buffer;
}): DocumentAppendArtifact =>
  appendDocumentParagraphs({
    ...input,
    paragraphs: [
      {
        text: "文枢 Word Modify 验证",
        bold: true,
      },
      {
        text: "这段内容由 Mira 文枢追加到现有 DOCX 的新副本中，原文件未被覆盖。",
      },
    ],
  });
