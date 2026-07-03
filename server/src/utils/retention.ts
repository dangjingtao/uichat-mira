export interface RetentionConfig {
  maxEntries: number;
  ttlMs: number;
}

export const DEFAULT_RETENTION_CONFIG: RetentionConfig = {
  maxEntries: 200,
  ttlMs: 1000 * 60 * 30,
};

const toTimestamp = (value?: string) => {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const sweepRetentionMap = <T>(
  map: Map<string, T>,
  options: {
    config: RetentionConfig;
    getUpdatedAt: (value: T) => string | undefined;
    now?: number;
    keep?: (value: T) => boolean;
  },
) => {
  const now = options.now ?? Date.now();
  const { maxEntries, ttlMs } = options.config;

  for (const [key, value] of map.entries()) {
    if (options.keep?.(value)) {
      continue;
    }

    const updatedAt = toTimestamp(options.getUpdatedAt(value));
    if (updatedAt > 0 && now - updatedAt > ttlMs) {
      map.delete(key);
    }
  }

  if (map.size <= maxEntries) {
    return;
  }

  const removableEntries = Array.from(map.entries())
    .filter(([, value]) => !options.keep?.(value))
    .sort(
      (left, right) =>
        toTimestamp(options.getUpdatedAt(left[1])) - toTimestamp(options.getUpdatedAt(right[1])),
    );

  while (map.size > maxEntries && removableEntries.length > 0) {
    const next = removableEntries.shift();
    if (!next) {
      break;
    }
    map.delete(next[0]);
  }
};
