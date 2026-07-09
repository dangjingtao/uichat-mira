import type {
  ImageGenerationJob,
  ImageGenerationProgressSnapshot,
  ImageGenerationRealtimeEvent,
  ImageGenerationRealtimeStore,
} from "./types.js";

type Listener = (event: ImageGenerationRealtimeEvent) => void;

const cloneJob = (job: ImageGenerationJob): ImageGenerationJob => ({
  ...job,
  artifacts: job.artifacts.map((artifact) => ({
    ...artifact,
    meta: artifact.meta ? { ...artifact.meta } : undefined,
  })),
  requestSummary: {
    ...job.requestSummary,
    providerParamKeys: [...job.requestSummary.providerParamKeys],
  },
  error: job.error
    ? {
        ...job.error,
        details: job.error.details ? { ...job.error.details } : undefined,
      }
    : undefined,
  meta: job.meta ? { ...job.meta } : undefined,
});

const cloneProgress = (
  progress: ImageGenerationProgressSnapshot,
): ImageGenerationProgressSnapshot => ({
  ...progress,
});

export const createInMemoryImageGenerationRealtimeStore =
  (): ImageGenerationRealtimeStore => {
    const jobs = new Map<string, ImageGenerationJob>();
    const progressSnapshots = new Map<string, ImageGenerationProgressSnapshot>();
    const listeners = new Map<string, Set<Listener>>();

    const emit = (generationId: string, event: ImageGenerationRealtimeEvent) => {
      const scoped = listeners.get(generationId);
      if (!scoped?.size) {
        return;
      }

      for (const listener of scoped) {
        listener(event);
      }
    };

    return {
      publishJob(job) {
        jobs.set(job.id, cloneJob(job));
        emit(job.id, {
          type: "job",
          generation: cloneJob(job),
        });
      },
      publishProgress(progress) {
        progressSnapshots.set(progress.generationId, cloneProgress(progress));
        emit(progress.generationId, {
          type: "progress",
          progress: cloneProgress(progress),
        });
      },
      subscribe(generationId, listener) {
        const scoped = listeners.get(generationId) ?? new Set<Listener>();
        scoped.add(listener);
        listeners.set(generationId, scoped);

        return () => {
          const current = listeners.get(generationId);
          if (!current) {
            return;
          }
          current.delete(listener);
          if (current.size === 0) {
            listeners.delete(generationId);
          }
        };
      },
      getJob(generationId) {
        const job = jobs.get(generationId);
        return job ? cloneJob(job) : null;
      },
      getProgress(generationId) {
        const progress = progressSnapshots.get(generationId);
        return progress ? cloneProgress(progress) : null;
      },
    };
  };
