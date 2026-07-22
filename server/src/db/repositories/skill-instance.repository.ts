import { getSqlite } from "@/db";
import type { SkillInstance } from "@/skill/types";

const serializeJson = (value: unknown) => JSON.stringify(value);

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

type SkillInstanceRow = {
  id: string;
  run_id: string;
  thread_id: string;
  user_id: number;
  skill_id: string;
  skill_version: string;
  status: SkillInstance["status"];
  stage: string | null;
  input_json: string | null;
  state_json: string;
  output_json: string | null;
  artifact_refs_json: string;
  checkpoint_ref: string | null;
  error: string | null;
  evidence_cursor_json: string;
  created_at: string;
  updated_at: string;
};

const rowToInstance = (row: SkillInstanceRow): SkillInstance => ({
  id: row.id,
  runId: row.run_id,
  threadId: row.thread_id,
  userId: row.user_id,
  skillId: row.skill_id,
  skillVersion: row.skill_version,
  status: row.status,
  stage: row.stage ?? undefined,
  input: parseJson(row.input_json, undefined),
  state: parseJson(row.state_json, {}),
  output: parseJson(row.output_json, undefined),
  artifactRefs: parseJson(row.artifact_refs_json, []),
  checkpointRef: row.checkpoint_ref ?? undefined,
  error: row.error ?? undefined,
  evidenceCursor: parseJson(row.evidence_cursor_json, {
    observations: 0,
    toolExecutions: 0,
    retrievals: 0,
  }),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getRow = (where: "id" | "run_id", value: string) =>
  getSqlite()
    .prepare(`SELECT * FROM skill_instances WHERE ${where} = ? LIMIT 1`)
    .get(value) as SkillInstanceRow | undefined;

export const skillInstanceRepository = {
  create(instance: SkillInstance) {
    getSqlite()
      .prepare(`
        INSERT INTO skill_instances (
          id, run_id, thread_id, user_id, skill_id, skill_version, status, stage,
          input_json, state_json, output_json, artifact_refs_json, checkpoint_ref,
          error, evidence_cursor_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        instance.id,
        instance.runId,
        instance.threadId,
        instance.userId,
        instance.skillId,
        instance.skillVersion,
        instance.status,
        instance.stage ?? null,
        serializeJson(instance.input),
        serializeJson(instance.state),
        instance.output === undefined ? null : serializeJson(instance.output),
        serializeJson(instance.artifactRefs),
        instance.checkpointRef ?? null,
        instance.error ?? null,
        serializeJson(instance.evidenceCursor),
        instance.createdAt,
        instance.updatedAt,
      );
    return instance;
  },

  get(instanceId: string) {
    const row = getRow("id", instanceId);
    return row ? rowToInstance(row) : undefined;
  },

  getByRunId(runId: string) {
    const row = getRow("run_id", runId);
    return row ? rowToInstance(row) : undefined;
  },

  update(
    instanceId: string,
    patch: Partial<Omit<SkillInstance, "id" | "createdAt">>,
  ) {
    const current = this.get(instanceId);
    if (!current) {
      throw new Error(`SkillInstance not found: ${instanceId}`);
    }
    const next: SkillInstance = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    getSqlite()
      .prepare(`
        UPDATE skill_instances SET
          run_id = ?, thread_id = ?, user_id = ?, skill_id = ?, skill_version = ?,
          status = ?, stage = ?, input_json = ?, state_json = ?, output_json = ?,
          artifact_refs_json = ?, checkpoint_ref = ?, error = ?,
          evidence_cursor_json = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        next.runId,
        next.threadId,
        next.userId,
        next.skillId,
        next.skillVersion,
        next.status,
        next.stage ?? null,
        serializeJson(next.input),
        serializeJson(next.state),
        next.output === undefined ? null : serializeJson(next.output),
        serializeJson(next.artifactRefs),
        next.checkpointRef ?? null,
        next.error ?? null,
        serializeJson(next.evidenceCursor),
        next.updatedAt,
        instanceId,
      );
    return next;
  },

  clear() {
    getSqlite().prepare("DELETE FROM skill_instances").run();
  },
};
