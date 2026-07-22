import { client, post, type AxiosResponse } from "@/shared/lib/request";

const OFFICE_SUITE_INSPECT_ROUTE = "/microapps/office-suite/inspect";
const OFFICE_SUITE_CREATE_ROUTE = "/microapps/office-suite/create";
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

export async function createExcelVerificationCopy(
  file: File,
): Promise<OfficeSuiteCreatedDownload> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await client.post<Blob>(
    OFFICE_SUITE_EXCEL_VERIFY_ROUTE,
    formData,
    {
      responseType: "blob",
      timeout: 0,
    },
  );

  const baseName = file.name.replace(/\.xlsx$/i, "") || "workbook";
  return toDownload(response, "excel", `${baseName}-wenshu.xlsx`);
}
