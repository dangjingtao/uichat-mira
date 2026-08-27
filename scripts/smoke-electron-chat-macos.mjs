import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") {
  throw new Error("Electron Chat macOS smoke requires darwin");
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const rootRequire = createRequire(new URL("../package.json", import.meta.url));
const desktopRequire = createRequire(
  new URL("../desktop/package.json", import.meta.url),
);
const electronBinary = rootRequire("electron");
const { _electron: electron } = desktopRequire("playwright");

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate a local smoke port"));
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });

const backendPort = await getFreePort();
const desktopPort = await getFreePort();
const testArtifactRoot = path.join(repositoryRoot, ".test-artifact");
fs.mkdirSync(testArtifactRoot, { recursive: true });
const smokeRoot = fs.mkdtempSync(
  path.join(testArtifactRoot, "macos-electron-chat-"),
);
const databaseDir = path.join(smokeRoot, "database");
const logDir = path.join(smokeRoot, "logs");
const attachmentsDir = path.join(smokeRoot, "attachments");
const workspaceRoot = path.join(smokeRoot, "Workspace macOS 中文");
const customWorkspaceRoot = path.join(
  smokeRoot,
  "深度使用 Workspace macOS",
);
const customWorkspaceName = "Mac 深度使用 Workspace";
for (const directory of [
  databaseDir,
  logDir,
  attachmentsDir,
  workspaceRoot,
  customWorkspaceRoot,
]) {
  fs.mkdirSync(directory, { recursive: true });
}

const sampleFileName = "普通附件 macOS.txt";
const sampleFilePath = path.join(smokeRoot, sampleFileName);
const sampleContents = "macOS attachment smoke ok\n";
fs.writeFileSync(sampleFilePath, sampleContents);

const backendOrigin = `http://127.0.0.1:${backendPort}`;
const desktopOrigin = `http://127.0.0.1:${desktopPort}`;
const smokeEnv = {
  ...process.env,
  NODE_ENV: "development",
  UI_CHAT_ALLOW_DEFAULT_BOOTSTRAP: "1",
  UI_CHAT_BACKEND_PORT: String(backendPort),
  UI_CHAT_DESKTOP_PORT: String(desktopPort),
  UI_CHAT_BACKEND_URL: backendOrigin,
  UI_CHAT_DATABASE_DIR: databaseDir,
  UI_CHAT_LOG_DIR: logDir,
  UI_CHAT_ATTACHMENTS_DIR: attachmentsDir,
  UI_CHAT_WORKSPACE_ROOT: workspaceRoot,
  JWT_SECRET: "macos-electron-chat-smoke-jwt",
  SETTINGS_SECRET: "macos-electron-chat-smoke-settings",
};

const serviceProcesses = [];
const serviceLogs = new Map();
let electronApp = null;

const appendLog = (name, chunk) => {
  const current = serviceLogs.get(name) ?? "";
  serviceLogs.set(name, `${current}${String(chunk)}`.slice(-16_000));
};

const startService = (name, cwd, command) => {
  const child = spawn("sh", ["-c", command], {
    cwd,
    env: smokeEnv,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk) => appendLog(name, chunk));
  child.stderr?.on("data", (chunk) => appendLog(name, chunk));
  serviceProcesses.push({ name, child });
  return child;
};

const waitForHttp = async (name, url, child, timeoutMs = 60_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `${name} exited before readiness (${child.exitCode})\n${serviceLogs.get(name) ?? ""}`,
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Service is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(
    `Timed out waiting for ${name}: ${url}\n${serviceLogs.get(name) ?? ""}`,
  );
};

const isPortOpen = (port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(300);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });

const stopService = async ({ child }) => {
  if (child.exitCode !== null || !child.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    return;
  }
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline && child.exitCode === null) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // Process group already exited.
    }
  }
};

const waitForRendererWindow = async () => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const page = electronApp
      .windows()
      .find((window) => {
        try {
          const url = new URL(window.url());
          return (
            url.protocol === "http:" &&
            url.port === String(desktopPort) &&
            (url.hostname === "localhost" || url.hostname === "127.0.0.1")
          );
        } catch {
          return false;
        }
      });
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Electron renderer window did not load the desktop origin");
};

try {
  const backend = startService(
    "backend",
    path.join(repositoryRoot, "server"),
    "pnpm dev",
  );
  const desktop = startService(
    "desktop",
    path.join(repositoryRoot, "desktop"),
    "pnpm dev",
  );
  await Promise.all([
    waitForHttp("backend", `${backendOrigin}/health`, backend),
    waitForHttp("desktop", desktopOrigin, desktop),
  ]);

  electronApp = await electron.launch({
    executablePath: electronBinary,
    args: ["."],
    cwd: path.join(repositoryRoot, "electron"),
    env: smokeEnv,
  });
  const page = await waitForRendererWindow();
  const rendererErrors = [];
  page.on("pageerror", (error) => rendererErrors.push(error.message));

  await page.waitForURL((url) => url.hash.includes("/login"), {
    timeout: 30_000,
  });
  await page.locator('input[autocomplete="username"]').fill("Tomz");
  await page.locator('input[autocomplete="current-password"]').fill("123456");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.hash.includes("/chat"), {
    timeout: 30_000,
  });

  const runtime = await page.evaluate(() => globalThis.window.desktopRuntime);
  if (
    runtime?.hostKind !== "electron" ||
    runtime?.platform !== "darwin" ||
    runtime?.backendUrl !== backendOrigin
  ) {
    throw new Error(`Unexpected desktop runtime: ${JSON.stringify(runtime)}`);
  }

  await page
    .getByRole("button", {
      name: /^(Create Workspace|创建工作空间)$/,
    })
    .first()
    .click();
  const workspaceDialog = page.getByRole("dialog");
  await workspaceDialog
    .getByLabel(/^(Workspace Name|工作空间名称)$/)
    .fill(customWorkspaceName);
  await workspaceDialog
    .getByLabel(/^(Workspace Root Path|工作空间根目录)$/)
    .fill(customWorkspaceRoot);
  await workspaceDialog
    .getByRole("button", {
      name: /^(Create Workspace|创建工作空间)$/,
    })
    .click();
  await workspaceDialog.waitFor({ state: "hidden", timeout: 30_000 });
  await page.getByText(customWorkspaceName, { exact: true }).waitFor({
    state: "visible",
    timeout: 30_000,
  });

  const composer = page.locator("textarea").last();
  await composer.waitFor({ state: "visible", timeout: 30_000 });
  await composer.fill("macOS Chat smoke draft");
  if ((await composer.inputValue()) !== "macOS Chat smoke draft") {
    throw new Error("Chat composer did not retain the smoke draft");
  }

  await page.getByRole("button", { name: "Composer menu" }).click();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByText("Add image or file", { exact: true }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(sampleFilePath);
  await page.getByText(sampleFileName, { exact: true }).waitFor({
    state: "visible",
    timeout: 30_000,
  });

  const authToken = await page.evaluate(() => {
    const rawSession = globalThis.localStorage.getItem("rag-demo-auth-session");
    if (!rawSession) return "";
    try {
      return JSON.parse(rawSession)?.token ?? "";
    } catch {
      return "";
    }
  });
  if (!authToken) {
    throw new Error("Authenticated Electron session did not persist a token");
  }
  const workspaceResponse = await fetch(`${backendOrigin}/chat-workspaces`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!workspaceResponse.ok) {
    throw new Error(
      `Workspace list failed after UI creation: ${workspaceResponse.status}`,
    );
  }
  const workspacePayload = await workspaceResponse.json();
  const createdWorkspace = workspacePayload?.data?.find(
    (workspace) => workspace?.name === customWorkspaceName,
  );
  if (createdWorkspace?.rootPath !== customWorkspaceRoot) {
    throw new Error(
      `Workspace created by UI was not persisted: ${JSON.stringify(workspacePayload)}`,
    );
  }

  const uploadForm = new FormData();
  uploadForm.append(
    "file",
    new File([fs.readFileSync(sampleFilePath)], sampleFileName, {
      type: "text/plain",
    }),
  );
  const uploadResponse = await fetch(`${backendOrigin}/attachments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken}` },
    body: uploadForm,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Attachment upload failed: ${uploadResponse.status}`);
  }
  const uploadPayload = await uploadResponse.json();
  const storedFileName = uploadPayload?.data?.fileName;
  if (typeof storedFileName !== "string" || !storedFileName.endsWith(".txt")) {
    throw new Error(`Unexpected attachment response: ${JSON.stringify(uploadPayload)}`);
  }

  const storedPath = path.join(attachmentsDir, storedFileName);
  if (!fs.existsSync(storedPath) || fs.readFileSync(storedPath, "utf8") !== sampleContents) {
    throw new Error(`Stored attachment does not match: ${storedPath}`);
  }
  if (rendererErrors.length > 0) {
    throw new Error(`Renderer errors: ${rendererErrors.join(" | ")}`);
  }

  console.log(
    JSON.stringify({
      platform: runtime.platform,
      hostKind: runtime.hostKind,
      backendUrl: runtime.backendUrl,
      chat: {
        route: page.url(),
        composerVisible: true,
        draftRetained: true,
      },
      workspace: {
        name: customWorkspaceName,
        rootPath: customWorkspaceRoot,
        responseStatus: workspaceResponse.status,
        visible: true,
        persisted: true,
      },
      attachment: {
        originalName: sampleFileName,
        storedFileName,
        responseStatus: uploadResponse.status,
        draftVisible: true,
        authenticatedApi: true,
        persisted: true,
      },
    }),
  );
} catch (error) {
  const logs = Array.from(serviceLogs.entries())
    .map(([name, output]) => `\n--- ${name} ---\n${output}`)
    .join("");
  throw new Error(`${error instanceof Error ? error.message : String(error)}${logs}`);
} finally {
  if (electronApp) {
    await electronApp.close().catch(() => undefined);
  }
  await Promise.all(serviceProcesses.map(stopService));
  const cleanupDeadline = Date.now() + 5_000;
  while (
    Date.now() < cleanupDeadline &&
    ((await isPortOpen(backendPort)) || (await isPortOpen(desktopPort)))
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if ((await isPortOpen(backendPort)) || (await isPortOpen(desktopPort))) {
    throw new Error("macOS Electron Chat smoke left a listener running");
  }
  fs.rmSync(smokeRoot, { recursive: true, force: true });
}
