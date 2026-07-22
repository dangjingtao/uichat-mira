import { client, post } from "@/shared/lib/request";

const OFFICE_SUITE_INSPECT_ROUTE = "/microapps/office-suite/inspect";
const OFFICE_SUITE_CREATE_ROUTE = "/microapps/office-suite/create";

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

  const blob =
    response.data instanceof Blob
      ? response.data
      : new Blob([response.data], {
          type: String(
            response.headers["content-type"] || "application/octet-stream",
          ),
        });

  return {
    kind,
    fileName:
      parseAttachmentFileName(response.headers["content-disposition"]) ||
      defaultFileName[kind],
    blob,
  };
}
