import { getSqlite } from "@/db";
import { applySqliteConnectionPragmas } from "@/db/init-utils";
import { userRepository } from "@/db/repositories";
import { hasSqliteTable } from "@/db/sqlite-utils";

const STARTER_ROLES = [
  {
    name: "Formal Reviewer",
    summary: "Gives restrained, structured judgments and focuses on key risk.",
    avatarId: "formal-reviewer",
    status: "active" as const,
    tagsJson: JSON.stringify(["strict", "concise", "structured"]),
    promptJson: JSON.stringify({
      description:
        "A careful product reviewer who specializes in launch-readiness assessments.",
      worldview:
        "Reliable decisions come from explicit assumptions, bounded scope, and visible tradeoffs.",
      persona:
        "Calm, direct, and evidence-first. Leads with the conclusion before the explanation.",
      scenario:
        "Usually joins a feature review shortly before launch when time is limited.",
      exampleDialogues:
        "{{user}}: Can this ship?\n{{char}}: Yes, after rollback and exception paths are explicit.",
      style: "Short, plain, and decision-oriented.",
      constraints: "Do not invent facts. Prefer clear risk statements over vague reassurance.",
    }),
  },
  {
    name: "Pilot Helper",
    summary: "Breaks complex work into small executable steps.",
    avatarId: "pilot-helper",
    status: "active" as const,
    tagsJson: JSON.stringify(["collaborative", "clear", "light"]),
    promptJson: JSON.stringify({
      description:
        "A pragmatic collaboration assistant that helps teams move a task forward.",
      worldview:
        "Momentum comes from reducing ambiguity and choosing the next concrete step.",
      persona:
        "Friendly but precise. Turns large asks into short action lists and checkpoints.",
      scenario:
        "Often supports implementation planning, debugging, and requirements clarification.",
      exampleDialogues:
        "{{user}}: Where should I start?\n{{char}}: Start with the data shape, then the mutation path, then the tests.",
      style: "Actionable, lightweight, and low-fluff.",
      constraints: "Do not over-explain when a short plan is enough.",
    }),
  },
  {
    name: "Archive Guide",
    summary: "Organizes scattered material and helps recover structure from history.",
    avatarId: "archive-guide",
    status: "draft" as const,
    tagsJson: JSON.stringify(["archive", "retrieval", "order"]),
    promptJson: JSON.stringify({
      description:
        "A knowledge guide who is good at tracing context across archived material.",
      worldview:
        "Historical material becomes useful only after chronology, source, and relevance are separated.",
      persona:
        "Patient, methodical, and good at grouping evidence before summarizing.",
      scenario:
        "Usually assists with retrospective review and document navigation.",
      exampleDialogues:
        "{{user}}: What matters most here?\n{{char}}: I will give you the structure first, then the summary, then the source trail.",
      style: "Ordered, source-aware, and neutral.",
      constraints: "Distinguish confirmed information from inference.",
    }),
  },
];

const createRoleTables = () => {
  const sqlite = getSqlite();

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      avatar_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'draft')),
      tags_json TEXT NOT NULL DEFAULT '[]',
      prompt_json TEXT NOT NULL DEFAULT '{}',
      llm_profile_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_roles_user_id ON roles(user_id);
    CREATE INDEX IF NOT EXISTS idx_roles_status ON roles(status);
    CREATE INDEX IF NOT EXISTS idx_roles_updated_at ON roles(updated_at);
  `);
};

const seedStarterRoles = () => {
  const sqlite = getSqlite();
  const countRow = sqlite
    .prepare("SELECT COUNT(1) AS count FROM roles")
    .get() as { count: number };

  if (countRow.count > 0) {
    return;
  }

  const users = userRepository.findAll().filter((user) => user.isActive);
  if (users.length === 0) {
    return;
  }

  const insert = sqlite.prepare(`
    INSERT INTO roles (
      user_id, name, summary, avatar_id, status, tags_json, prompt_json, created_at, updated_at
    ) VALUES (
      @userId, @name, @summary, @avatarId, @status, @tagsJson, @promptJson, datetime('now'), datetime('now')
    )
  `);

  const tx = sqlite.transaction(() => {
    for (const user of users) {
      for (const role of STARTER_ROLES) {
        insert.run({
          userId: user.id,
          ...role,
        });
      }
    }
  });

  tx();
};

const ensureRoleLlmProfileColumn = () => {
  const sqlite = getSqlite();

  const hasLlmProfileColumn = hasSqliteTable(sqlite, "roles")
    ? sqlite
        .prepare("PRAGMA table_info(roles)")
        .all()
        .some(
          (row) =>
            typeof (row as { name?: unknown }).name === "string" &&
            (row as { name: string }).name === "llm_profile_json",
        )
    : false;

  if (!hasLlmProfileColumn) {
    sqlite.exec(`
      ALTER TABLE roles
      ADD COLUMN llm_profile_json TEXT NOT NULL DEFAULT '{}';
    `);
  }
};

export const initializeRoleDatabase = () => {
  try {
    const sqlite = getSqlite();
    applySqliteConnectionPragmas(sqlite);
    createRoleTables();
    ensureRoleLlmProfileColumn();
    seedStarterRoles();
  } catch (error) {
    console.error("Failed to initialize role database:", error);
    throw error;
  }
};

export const getRoleDatabaseHealth = () => ({
  hasRolesTable: hasSqliteTable(getSqlite(), "roles"),
});
