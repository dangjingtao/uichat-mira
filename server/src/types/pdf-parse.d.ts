declare module "pdf-parse" {
  interface PdfParseInfo {
    [key: string]: unknown;
  }

  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info?: PdfParseInfo;
    metadata?: unknown;
    text: string;
    version?: string;
  }

  export default function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, unknown>,
  ): Promise<PdfParseResult>;
}
