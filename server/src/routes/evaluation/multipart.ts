import type { FastifyRequest } from "fastify";
import path from "node:path";

/** Validation error that should surface as a 400 route response. */
export class EvaluationMultipartValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationMultipartValidationError";
  }
}

/** Normalized zip upload payload consumed by the evaluation parser. */
export interface ParsedEvaluationUpload {
  /** Original client-provided filename. */
  fileName: string;
  /** Lowercase extension without a leading dot. */
  fileExt: string;
  /** Multipart-reported MIME type. */
  mimeType: string | null;
  /** Uploaded byte size measured from the buffered content. */
  fileSize: number;
  /** Full zip bytes kept in memory for package parsing. */
  buffer: Buffer;
}

export const isMultipartTooLargeError = (
  err: unknown,
): err is Error & { statusCode: 413 } =>
  err instanceof Error && "statusCode" in err && err.statusCode === 413;

export const readSingleZipUpload = async (
  request: FastifyRequest,
): Promise<ParsedEvaluationUpload> => {
  if (!request.isMultipart()) {
    throw new EvaluationMultipartValidationError(
      "Expected multipart/form-data upload",
    );
  }

  let fileName = "";
  let fileExt = "";
  let mimeType: string | null = null;
  let fileSize = 0;
  let buffer: Buffer | null = null;

  for await (const part of request.parts()) {
    if (part.type !== "file") {
      continue;
    }

    if (fileName) {
      throw new EvaluationMultipartValidationError(
        "Only one file can be uploaded",
      );
    }

    const nextBuffer = await part.toBuffer();
    fileName = part.filename;
    fileExt = path.extname(part.filename).replace(/^\./, "").toLowerCase();
    mimeType = part.mimetype || "application/zip";
    fileSize = nextBuffer.byteLength;
    buffer = nextBuffer;
  }

  if (!fileName || !buffer) {
    throw new EvaluationMultipartValidationError("Please upload a zip file");
  }

  if (fileExt !== "zip") {
    throw new EvaluationMultipartValidationError(
      `Unsupported file type ".${fileExt}". Only .zip evaluation packages are supported.`,
    );
  }

  return {
    fileName,
    fileExt,
    mimeType,
    fileSize,
    buffer,
  };
};
