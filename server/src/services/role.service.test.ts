import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, test } from "vitest";
import { initializeAuthDatabase } from "@/db/auth.db";
import { initializeRoleDatabase } from "@/db/role.db";
import { initializeKnowledgeBaseDatabase } from "@/db/knowledge-base.db";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { initializeThreadDatabase } from "@/db/thread.db";
import { userRepository } from "@/db/repositories";
import { roleService } from "./role.service.js";

const testDbPath = path.join(
  os.tmpdir(),
  `rag-demo-role-service-${process.pid}-${Date.now()}.sqlite`,
);

process.env.DATABASE_URL = `file:${testDbPath}`;

initializeAuthDatabase();
initializeModelConfigDatabase();
initializeKnowledgeBaseDatabase();
initializeThreadDatabase();
initializeRoleDatabase();

afterAll(() => {
  try {
    fs.rmSync(testDbPath, { force: true });
  } catch {
    // ignore cleanup failure on Windows file locking
  }
});

test("role service seeds starter roles for bootstrap users", () => {
  const seededUser = userRepository.findAll().find((user) => user.isActive);
  assert.ok(seededUser);
  const roles = roleService.listRoles({ userId: seededUser.id });
  assert.ok(roles.length >= 3);
});

test("role service creates, updates and deletes user-owned roles", () => {
  const user = userRepository.create({
    username: `role-user-${crypto.randomUUID()}`,
    passwordHash: "hash",
    role: "user",
    isActive: true,
  });

  const created = roleService.createRole({
    userId: user.id,
    name: "  Product Reviewer  ",
    summary: "  Short summary  ",
    avatarId: "formal-reviewer",
    status: "draft",
    tags: [" strict ", "concise", "", "overflow"],
    prompt: {
      description: " desc ",
      persona: " persona ",
    },
    llmProfile: {
      temperature: 0.4,
      topP: 0.8,
      maxTokens: 1024,
    },
  });

  assert.equal(created.name, "Product Reviewer");
  assert.deepEqual(created.tags, ["strict", "concise", "overflow"]);
  assert.equal(created.prompt.description, "desc");
  assert.equal(created.prompt.persona, "persona");
  assert.equal(created.prompt.scenario, "");
  assert.deepEqual(created.llmProfile, {
    temperature: 0.4,
    topP: 0.8,
    maxTokens: 1024,
  });

  const updated = roleService.updateRole(created.id, user.id, {
    status: "active",
    tags: ["alpha", "beta"],
    prompt: {
      scenario: " launch review ",
    },
    llmProfile: {
      temperature: 0.2,
      topK: 24,
    },
  });

  assert.equal(updated?.status, "active");
  assert.deepEqual(updated?.tags, ["alpha", "beta"]);
  assert.equal(updated?.prompt.description, "desc");
  assert.equal(updated?.prompt.scenario, "launch review");
  assert.deepEqual(updated?.llmProfile, {
    temperature: 0.2,
    topP: 0.8,
    topK: 24,
    maxTokens: 1024,
  });
  assert.equal(roleService.deleteRole(created.id, user.id), true);
  assert.equal(roleService.getRoleById(created.id, user.id), null);
});
