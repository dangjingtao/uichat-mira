import { client, del } from "@/shared/lib/request";
import { getSession } from "@/shared/lib/sessionStorage";
import { getApiBaseUrl } from "@/shared/platform/desktopRuntime";

export interface ClearBackendLogsResult {
  directory: string;
  clearedFiles: Array<{
    name: string;
    previousSize: number;
  }>;
}

export interface RuntimeLogSnapshotEvent {
  type: "snapshot";
  entries: string[];
}

export interface RuntimeLogAppendEvent {
  type: "append";
  entry: string;
}

export type RuntimeLogStreamEvent =
  | RuntimeLogSnapshotEvent
  | RuntimeLogAppendEvent;

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

export const readSseFrames = (buffer: string) => {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const segments = normalized.split("\n\n");
  if (segments.length === 1) {
    return {
      frames: [] as string[],
      rest: normalized,
    };
  }

  const rest = segments.pop() ?? "";
  const frames = segments
    .map((segment) =>
      segment
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n"),
    )
    .filter(Boolean);

  return {
    frames,
    rest,
  };
};

export async function streamRuntimeLogs(
  input: {
    signal?: AbortSignal;
    limit?: number;
  },
  onEvent: (event: RuntimeLogStreamEvent) => void | Promise<void>,
) {
  const session = getSession();
  const url = new URL(`${getApiBaseUrl()}/logs/stream`, window.location.origin);
  if (input.limit) {
    url.searchParams.set("limit", String(input.limit));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    signal: input.signal,
  });

  if (!response.ok) {
    throw new Error(`Runtime log stream failed with HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Runtime log stream is unavailable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const { frames, rest } = readSseFrames(buffer);
    buffer = rest;

    for (const frame of frames) {
      if (!frame.trim()) {
        continue;
      }

      await onEvent(JSON.parse(frame) as RuntimeLogStreamEvent);
    }
  }

  buffer += decoder.decode();
  const { frames } = readSseFrames(`${buffer}\n\n`);
  for (const frame of frames) {
    if (!frame.trim()) {
      continue;
    }

    await onEvent(JSON.parse(frame) as RuntimeLogStreamEvent);
  }
}
