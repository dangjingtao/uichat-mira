import { getSqlite } from "@/db";
import { applySqliteConnectionPragmas } from "@/db/init-utils";
import { hasSqliteTable } from "@/db/sqlite-utils";
import type {
  EvaluationDatasetRecord,
  EvaluationDatasetSample,
  EvaluationMetricSummary,
  EvaluationRunRecord,
} from "@/routes/evaluation/types.js";

type PersistedEvaluationDatasetRow = {
  id: string;
  knowledge_base_id: string | null;
  dataset_name: string;
  file_name: string;
  file_size: number;
  uploaded_at: string;
  dataset_json: string;
  samples_json: string;
};

type PersistedEvaluationRunRow = {
  id: string;
  dataset_id: string;
  name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  run_json: string;
};

const ensureEvaluationTables = () => {
  const sqlite = getSqlite();

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS evaluation_datasets (
      id TEXT PRIMARY KEY,
      knowledge_base_id TEXT,
      dataset_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      dataset_json TEXT NOT NULL,
      samples_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evaluation_runs (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL REFERENCES evaluation_datasets(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      run_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_evaluation_datasets_uploaded_at
      ON evaluation_datasets(uploaded_at);
    CREATE INDEX IF NOT EXISTS idx_evaluation_runs_dataset_id
      ON evaluation_runs(dataset_id);
    CREATE INDEX IF NOT EXISTS idx_evaluation_runs_started_at
      ON evaluation_runs(started_at);
    CREATE INDEX IF NOT EXISTS idx_evaluation_runs_status
      ON evaluation_runs(status);
  `);
};

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const defaultMetrics = (): EvaluationMetricSummary => ({
  hitAtK: 0,
  recallAtK: 0,
  mrr: 0,
  faithfulness: 0,
  answerRelevance: 0,
  answerCompleteness: 0,
  sourceHitRate: 0,
  averageLatencyMs: 0,
  failedCount: 0,
});

const normalizeRunRecord = (run: EvaluationRunRecord): EvaluationRunRecord => ({
  ...run,
  metrics: {
    ...defaultMetrics(),
    ...run.metrics,
  },
  sampleResults: (run.sampleResults ?? []).map((sample) => ({
    ...sample,
    goldSources: sample.goldSources ?? [],
    matchedGoldSources: sample.matchedGoldSources ?? [],
    retrievedSources: sample.retrievedSources ?? [],
    answerText: sample.answerText ?? "",
    referenceAnswer: sample.referenceAnswer ?? "",
    answerRelevance: sample.answerRelevance ?? 0,
    answerCompleteness: sample.answerCompleteness ?? 0,
    attempts: (sample.attempts ?? []).map((attempt) => ({
      ...attempt,
      answerText: attempt.answerText ?? "",
      answerRelevance: attempt.answerRelevance ?? 0,
      answerCompleteness: attempt.answerCompleteness ?? 0,
      retrievedSources: attempt.retrievedSources ?? [],
    })),
  })),
});

export const initializeEvaluationDatabase = () => {
  try {
    const sqlite = getSqlite();
    applySqliteConnectionPragmas(sqlite);
    ensureEvaluationTables();
  } catch (error) {
    console.error("Failed to initialize evaluation database:", error);
    throw error;
  }
};

export const getEvaluationDatabaseHealth = () => {
  const sqlite = getSqlite();

  return {
    hasEvaluationDatasetsTable: hasSqliteTable(sqlite, "evaluation_datasets"),
    hasEvaluationRunsTable: hasSqliteTable(sqlite, "evaluation_runs"),
  };
};

export const upsertEvaluationDataset = (input: {
  dataset: EvaluationDatasetRecord;
  samples: EvaluationDatasetSample[];
  knowledgeBaseId?: string;
}) => {
  const sqlite = getSqlite();
  const statement = sqlite.prepare(`
    INSERT INTO evaluation_datasets (
      id,
      knowledge_base_id,
      dataset_name,
      file_name,
      file_size,
      uploaded_at,
      dataset_json,
      samples_json
    ) VALUES (
      @id,
      @knowledge_base_id,
      @dataset_name,
      @file_name,
      @file_size,
      @uploaded_at,
      @dataset_json,
      @samples_json
    )
    ON CONFLICT(id) DO UPDATE SET
      knowledge_base_id = excluded.knowledge_base_id,
      dataset_name = excluded.dataset_name,
      file_name = excluded.file_name,
      file_size = excluded.file_size,
      uploaded_at = excluded.uploaded_at,
      dataset_json = excluded.dataset_json,
      samples_json = excluded.samples_json
  `);

  statement.run({
    id: input.dataset.id,
    knowledge_base_id: input.knowledgeBaseId ?? null,
    dataset_name: input.dataset.datasetName,
    file_name: input.dataset.fileName,
    file_size: input.dataset.fileSize,
    uploaded_at: input.dataset.uploadedAt,
    dataset_json: JSON.stringify(input.dataset),
    samples_json: JSON.stringify(input.samples),
  });
};

export const listPersistedEvaluationDatasets = (): Array<{
  dataset: EvaluationDatasetRecord;
  samples: EvaluationDatasetSample[];
  knowledgeBaseId?: string;
}> => {
  const sqlite = getSqlite();
  const rows = sqlite
    .prepare(
      `
        SELECT
          id,
          knowledge_base_id,
          dataset_name,
          file_name,
          file_size,
          uploaded_at,
          dataset_json,
          samples_json
        FROM evaluation_datasets
        ORDER BY uploaded_at DESC
      `,
    )
    .all() as PersistedEvaluationDatasetRow[];

  return rows.map((row) => ({
    dataset: parseJson<EvaluationDatasetRecord>(row.dataset_json, {
      id: row.id,
      datasetName: row.dataset_name,
      fileName: row.file_name,
      fileSize: row.file_size,
      uploadedAt: row.uploaded_at,
      summary: {
        documentCount: 0,
        sampleCount: 0,
        hasReferenceAnswers: false,
        hasGoldSources: false,
      },
      config: {
        mode: "retrieve",
        topK: 8,
        topN: 3,
        repeat: 1,
        concurrency: 1,
        timeoutSeconds: 300,
      },
      documents: [],
      previewSamples: [],
      validations: [],
    }),
    samples: parseJson<EvaluationDatasetSample[]>(row.samples_json, []),
    ...(row.knowledge_base_id
      ? { knowledgeBaseId: row.knowledge_base_id }
      : {}),
  }));
};

export const upsertEvaluationRun = (run: EvaluationRunRecord) => {
  const sqlite = getSqlite();
  const statement = sqlite.prepare(`
    INSERT INTO evaluation_runs (
      id,
      dataset_id,
      name,
      status,
      started_at,
      completed_at,
      run_json,
      updated_at
    ) VALUES (
      @id,
      @dataset_id,
      @name,
      @status,
      @started_at,
      @completed_at,
      @run_json,
      datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      dataset_id = excluded.dataset_id,
      name = excluded.name,
      status = excluded.status,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      run_json = excluded.run_json,
      updated_at = datetime('now')
  `);

  statement.run({
    id: run.id,
    dataset_id: run.dataset.id,
    name: run.name,
    status: run.status,
    started_at: run.startedAt,
    completed_at: run.completedAt ?? null,
    run_json: JSON.stringify(run),
  });
};

export const listPersistedEvaluationRuns = (): EvaluationRunRecord[] => {
  const sqlite = getSqlite();
  const rows = sqlite
    .prepare(
      `
        SELECT
          id,
          dataset_id,
          name,
          status,
          started_at,
          completed_at,
          run_json
        FROM evaluation_runs
        ORDER BY started_at DESC
      `,
    )
    .all() as PersistedEvaluationRunRow[];

  return rows.map((row) =>
    normalizeRunRecord(
      parseJson<EvaluationRunRecord>(row.run_json, {
        id: row.id,
        name: row.name,
        dataset: {
          id: row.dataset_id,
          datasetName: "",
          fileName: "",
          fileSize: 0,
          uploadedAt: row.started_at,
          summary: {
            documentCount: 0,
            sampleCount: 0,
            hasReferenceAnswers: false,
            hasGoldSources: false,
          },
          config: {
            mode: "retrieve",
            topK: 8,
            topN: 3,
            repeat: 1,
            concurrency: 1,
            timeoutSeconds: 300,
          },
          documents: [],
          previewSamples: [],
          validations: [],
        },
        status: row.status as EvaluationRunRecord["status"],
        startedAt: row.started_at,
        completedAt: row.completed_at ?? undefined,
        metrics: defaultMetrics(),
        logs: [],
        sampleResults: [],
      }),
    ),
  );
};

export const deletePersistedEvaluationRun = (runId: string): boolean => {
  const sqlite = getSqlite();
  const statement = sqlite.prepare(`
    DELETE FROM evaluation_runs
    WHERE id = ?
  `);

  const result = statement.run(runId);
  return result.changes > 0;
};
