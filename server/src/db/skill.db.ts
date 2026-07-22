import { getSqlite } from "@/db";
import { applySqliteConnectionPragmas } from "@/db/init-utils";
import { hasSqliteTable } from "@/db/sqlite-utils";

export const initializeSkillDatabase = () => {
  const sqlite = getSqlite();
  applySqliteConnectionPragmas(sqlite);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS skill_instances (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL UNIQUE REFERENCES agent_runs(id) ON DELETE CASCADE,
      thread_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      skill_id TEXT NOT NULL,
      skill_version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'running', 'waiting', 'completed', 'failed', 'cancelled')),
      stage TEXT,
      input_json TEXT,
      state_json TEXT NOT NULL DEFAULT '{}',
      output_json TEXT,
      artifact_refs_json TEXT NOT NULL DEFAULT '[]',
      checkpoint_ref TEXT,
      error TEXT,
      evidence_cursor_json TEXT NOT NULL DEFAULT '{"observations":0,"toolExecutions":0,"retrievals":0}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_skill_instances_run_id ON skill_instances(run_id);
    CREATE INDEX IF NOT EXISTS idx_skill_instances_thread_id ON skill_instances(thread_id);
    CREATE INDEX IF NOT EXISTS idx_skill_instances_skill_id ON skill_instances(skill_id);
    CREATE INDEX IF NOT EXISTS idx_skill_instances_status ON skill_instances(status);
  `);
};

export const getSkillDatabaseHealth = () => ({
  hasSkillInstancesTable: hasSqliteTable(getSqlite(), "skill_instances"),
});
