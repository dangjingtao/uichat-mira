import { readRecentLogLines, subscribeToLogLines } from "@/logger";

const MAX_RECENT_LINES = 100;
const MAX_LINE_LENGTH = 4000;

const normalizeLogLine = (line: string) => {
  const trimmed = line.trimEnd();
  if (trimmed.length <= MAX_LINE_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_LINE_LENGTH)}… [truncated]`;
};

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

export const logStreamService = {
  async getRecentEntries(limit = MAX_RECENT_LINES) {
    const safeLimit = Math.max(1, Math.min(limit, MAX_RECENT_LINES));
    const lines = await readRecentLogLines(safeLimit);
    return lines.map(normalizeLogLine);
  },

  subscribe(listener: (event: RuntimeLogAppendEvent) => void) {
    return subscribeToLogLines((line) => {
      const normalized = normalizeLogLine(line);
      if (!normalized) {
        return;
      }

      listener({
        type: "append",
        entry: normalized,
      });
    });
  },
};

export const buildRuntimeLogSnapshotEvent = async (
  limit = MAX_RECENT_LINES,
): Promise<RuntimeLogSnapshotEvent> => ({
  type: "snapshot",
  entries: await logStreamService.getRecentEntries(limit),
});
