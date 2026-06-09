import { client, del } from "@/shared/lib/request";

export interface ClearBackendLogsResult {
  directory: string;
  clearedFiles: Array<{
    name: string;
    previousSize: number;
  }>;
}

export async function exportBackendLogs() {
  const response = await client.get("/logs/export", {
    responseType: "blob",
  });

  const disposition = response.headers["content-disposition"] as string | undefined;
  const fileNameMatch = disposition?.match(/filename="(.+?)"/i);

  return {
    blob: response.data as Blob,
    fileName: fileNameMatch?.[1] ?? "ui-chat-rag-logs.zip",
  };
}

export async function clearBackendLogs() {
  return del<ClearBackendLogsResult>("/logs");
}
