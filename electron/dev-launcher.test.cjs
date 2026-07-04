const test = require("node:test");
const assert = require("node:assert/strict");

const { buildBackendEnv } = require("./dev-launcher.cjs");

test("buildBackendEnv omits UI_CHAT_WORKSPACE_ROOT when it is not explicitly set", () => {
  const env = buildBackendEnv({
    PATH: "C:\\Windows\\System32",
  });

  assert.equal(env.UI_CHAT_ALLOW_BACKEND_REUSE, "1");
  assert.equal("UI_CHAT_WORKSPACE_ROOT" in env, false);
});

test("buildBackendEnv forwards explicit UI_CHAT_WORKSPACE_ROOT", () => {
  const env = buildBackendEnv({
    PATH: "C:\\Windows\\System32",
    UI_CHAT_WORKSPACE_ROOT: "D:\\workspace\\rag-demo",
  });

  assert.equal(env.UI_CHAT_ALLOW_BACKEND_REUSE, "1");
  assert.equal(env.UI_CHAT_WORKSPACE_ROOT, "D:\\workspace\\rag-demo");
});

test("buildBackendEnv trims explicit UI_CHAT_WORKSPACE_ROOT", () => {
  const env = buildBackendEnv({
    UI_CHAT_WORKSPACE_ROOT: "  D:\\workspace\\rag-demo  ",
  });

  assert.equal(env.UI_CHAT_WORKSPACE_ROOT, "D:\\workspace\\rag-demo");
});
