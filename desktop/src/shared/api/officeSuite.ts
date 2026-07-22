import { client, post, type AxiosResponse } from "@/shared/lib/request";

const OFFICE_SUITE_INSPECT_ROUTE = "/microapps/office-suite/inspect";
const OFFICE_SUITE_CREATE_ROUTE = "/microapps/office-suite/create";
const OFFICE_SUITE_WORD_VERIFY_ROUTE =
  "/microapps/office-suite/document/verification-copy";
const OFFICE_SUITE_EXCEL_VERIFY_ROUTE =
  "/microapps/office-suite/spreadsheet/verification-copy";

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

export type OfficeSuiteCreatedDownload = {
  kind: OfficeSuiteFileKind;
  fileName: string;
  blob: Blob;
};

const defaultFileName: Record<OfficeSuiteFileKind, string> = {
  word: "wenshu-word-sample.docx",
  excel: "wenshu-excel-sample.xlsx",
  powerpoint: "wenshu-powerpoint-sample.pptx",
};

const parseAttachmentFileName = (contentDisposition: unknown) => {
  if (typeof contentDisposition !== "string") return null;
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  return match?.[1]?.trim() || null;
};

const toDownload = (
  response: AxiosResponse<Blob>,
  kind: OfficeSuiteFileKind,
  fallbackFileName: string,
): OfficeSuiteCreatedDownload => ({
  kind,
  fileName:
    parseAttachmentFileName(response.headers["content-disposition"]) ||
    fallbackFileName,
  blob: response.data,
});

const uploadForVerificationCopy = async (
  route: string,
  file: File,
  kind: OfficeSuiteFileKind,
  fallbackFileName: string,
) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await client.post<Blob>(route, formData, {
    responseType: "blob",
    timeout: 0,
  });
  return toDownload(response, kind, fallbackFileName);
};

export async function inspectOfficeFile(file: File): Promise<OfficeSuiteInspection> {
  const formData = new FormData();
  formData.append("file", file);
  return post<OfficeSuiteInspection>(OFFICE_SUITE_INSPECT_ROUTE, formData, {
    timeout: 0,
  });
}

export async function createOfficeSample(
  kind: OfficeSuiteFileKind,
): Promise<OfficeSuiteCreatedDownload> {
  const response = await client.post<Blob>(
    OFFICE_SUITE_CREATE_ROUTE,
    { kind },
    {
      responseType: "blob",
      timeout: 0,
    },
  );

  return toDownload(response, kind, defaultFileName[kind]);
}

export async function createWordVerificationCopy(
  file: File,
): Promise<OfficeSuiteCreatedDownload> {
  const baseName = file.name.replace(/\.docx$/i, "") || "document";
  return uploadForVerificationCopy(
    OFFICE_SUITE_WORD_VERIFY_ROUTE,
    file,
    "word",
    `${baseName}-wenshu.docx`,
  );
}

export async function createExcelVerificationCopy(
  file: File,
): Promise<OfficeSuiteCreatedDownload> {
  const baseName = file.name.replace(/\.xlsx$/i, "") || "workbook";
  return uploadForVerificationCopy(
    OFFICE_SUITE_EXCEL_VERIFY_ROUTE,
    file,
    "excel",
    `${baseName}-wenshu.xlsx`,
  );
}
