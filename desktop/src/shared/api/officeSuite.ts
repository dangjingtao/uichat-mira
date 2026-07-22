import { post } from "@/shared/lib/request";

const OFFICE_SUITE_INSPECT_ROUTE = "/microapps/office-suite/inspect";

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

export async function inspectOfficeFile(file: File): Promise<OfficeSuiteInspection> {
  const formData = new FormData();
  formData.append("file", file);
  return post<OfficeSuiteInspection>(OFFICE_SUITE_INSPECT_ROUTE, formData, {
    timeout: 0,
  });
}
