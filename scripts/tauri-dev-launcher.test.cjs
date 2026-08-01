const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  resolveBackendWorkspaceRoot,
} = require("./tauri-dev-launcher.cjs");

const createTempRoot = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), "mira-tauri-launcher-"));

test("creates the owned default workspace", (t) => {
  const tempRoot = createTempRoot();
  const defaultWorkspaceRoot = path.join(tempRoot, "Default Workspace");
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const resolved = resolveBackendWorkspaceRoot({}, defaultWorkspaceRoot);

  assert.equal(resolved, path.resolve(defaultWorkspaceRoot));
  assert.equal(fs.statSync(defaultWorkspaceRoot).isDirectory(), true);
});

test("uses an existing explicit workspace without modifying it", (t) => {
  const tempRoot = createTempRoot();
  const explicitRoot = path.join(tempRoot, "custom-workspace");
  fs.mkdirSync(explicitRoot, { recursive: true });
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const resolved = resolveBackendWorkspaceRoot({
    UI_CHAT_WORKSPACE_ROOT: `  ${explicitRoot}  `,
  });

  assert.equal(resolved, path.resolve(explicitRoot));
});

test("rejects a missing explicit workspace without creating it", (t) => {
  const tempRoot = createTempRoot();
  const missingRoot = path.join(tempRoot, "missing-workspace");
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  assert.throws(
    () =>
      resolveBackendWorkspaceRoot({
        UI_CHAT_WORKSPACE_ROOT: missingRoot,
      }),
    /UI_CHAT_WORKSPACE_ROOT does not exist/,
  );
  assert.equal(fs.existsSync(missingRoot), false);
});
