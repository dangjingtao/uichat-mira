import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeAppMetaJsons } from "../scripts/app-meta-generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const outputDir = path.join(projectRoot, ".artifacts", "server-bundle");
const outputNodeModules = path.join(outputDir, "node_modules");
const pnpmStore = path.join(projectRoot, "node_modules", ".pnpm");
const pnpmVirtualNodeModules = path.join(pnpmStore, "node_modules");

function readPackageJson(packageDir) {
  return JSON.parse(
    fs.readFileSync(path.join(packageDir, "package.json"), "utf-8"),
  );
}

function writeAppMetaJson() {
  writeAppMetaJsons(projectRoot, [path.join(outputDir, "app-meta.json")]);
}

function copyToolsDir() {
  const toolsSource = path.join(__dirname, "tools");
  const toolsDest = path.join(outputDir, "tools");

  if (!fs.existsSync(toolsSource)) {
    return;
  }

  fs.cpSync(toolsSource, toolsDest, { recursive: true, dereference: true });
  console.log(`Copied built-in tools: ${toolsDest}`);
}

function copySkillsDir() {
  const skillsSource = path.join(__dirname, "src", "skills");
  const skillsDest = path.join(outputDir, "skills");

  if (!fs.existsSync(skillsSource)) {
    return;
  }

  fs.cpSync(skillsSource, skillsDest, {
    recursive: true,
    dereference: true,
    filter: (source) => {
      if (fs.statSync(source).isDirectory()) return true;
      const extension = path.extname(source).toLowerCase();
      return [".md", ".txt", ".json", ".yaml", ".yml"].includes(extension);
    },
  });
  console.log(`Copied built-in Skill resources: ${skillsDest}`);
}

function copyStaticDir() {
  const staticSource = path.join(__dirname, "static");
  const staticDest = path.join(outputDir, "static");
  const swaggerUiPackageSource = resolveInstalledPackageSource("@fastify/swagger-ui");
  const brandingLogoSource = path.join(
    projectRoot,
    "desktop",
    "src",
    "assets",
    "branding",
    "uichat-logo-icon.png",
  );

  if (!fs.existsSync(staticSource)) {
    fs.mkdirSync(staticDest, { recursive: true });
  } else {
    fs.cpSync(staticSource, staticDest, { recursive: true, dereference: true });
  }

  if (!fs.existsSync(brandingLogoSource)) {
    throw new Error(`Missing branding logo: ${brandingLogoSource}`);
  }

  if (!swaggerUiPackageSource) {
    throw new Error("Cannot find installed package for @fastify/swagger-ui");
  }

  const swaggerUiLogoSource = path.join(swaggerUiPackageSource, "logo.svg");
  if (!fs.existsSync(swaggerUiLogoSource)) {
    throw new Error(`Missing Swagger UI logo: ${swaggerUiLogoSource}`);
  }

  fs.copyFileSync(brandingLogoSource, path.join(staticDest, "logo.png"));
  fs.copyFileSync(swaggerUiLogoSource, path.join(staticDest, "logo.svg"));
  console.log(`Copied static assets: ${staticDest}`);
}

function resolveInstalledPackageSource(packageName) {
  const virtualPackageJson = path.join(
    pnpmVirtualNodeModules,
    packageName,
    "package.json",
  );
  if (fs.existsSync(virtualPackageJson)) {
    return path.dirname(fs.realpathSync(virtualPackageJson));
  }

  const packageDirName = fs
    .readdirSync(pnpmStore)
    .find((name) => name.startsWith(`${packageName}@`));

  if (!packageDirName) {
    return null;
  }

  return path.join(pnpmStore, packageDirName, "node_modules", packageName);
}

function copyPackage(packageName) {
  const serverPackage = readPackageJson(__dirname);
  const version = serverPackage.dependencies?.[packageName];
  const source = resolveInstalledPackageSource(packageName);

  if (!source) {
    const suffix = version ? `@${version}` : "";
    throw new Error(`Cannot find installed pnpm package for ${packageName}${suffix}`);
  }
  const destination = path.join(outputNodeModules, packageName);

  if (!fs.existsSync(source)) {
    throw new Error(`Cannot find package ${packageName} at ${source}`);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true, dereference: true });
  console.log(`Copied native package ${packageName}`);
}

// 交叉构建（Linux -> Windows）时，pnpm store 里的 better-sqlite3 是 Linux ELF，
// 直接打包会导致 Windows 后端启动崩溃（ERR_DLOPEN_FAILED / not a valid Win32 application）。
// 这里用仓库内固化的 Windows PE 副本强制覆盖，并校验文件头，避免误用 Linux 二进制。
function injectWin32BetterSqlite3() {
  if (process.platform === "win32") {
    return;
  }

  const prebuiltPath = path.join(
    projectRoot,
    ".artifacts",
    "win32-prebuilt",
    "better_sqlite3.win32-x64.node",
  );
  const targetPath = path.join(
    outputNodeModules,
    "better-sqlite3",
    "build",
    "Release",
    "better_sqlite3.node",
  );

  if (!fs.existsSync(prebuiltPath)) {
    throw new Error(
      `Missing Windows better-sqlite3 prebuilt binary: ${prebuiltPath}. ` +
        "Run scripts/capture-win32-better-sqlite3.mjs first or restore the artifact.",
    );
  }

  fs.copyFileSync(prebuiltPath, targetPath);

  const header = fs.readFileSync(targetPath).subarray(0, 2).toString("latin1");
  if (header !== "MZ") {
    throw new Error(
      `Injected better-sqlite3 is not a Windows PE binary (got ${JSON.stringify(header)}): ${targetPath}`,
    );
  }

  console.log(
    "Cross-build: injected Windows better-sqlite3 PE binary into server bundle",
  );
}

function copyPackageTree(packageName, copied = new Set()) {
  if (copied.has(packageName)) {
    return;
  }

  copied.add(packageName);
  const source = resolveInstalledPackageSource(packageName);
  if (!source) {
    throw new Error(`Cannot find installed package ${packageName}`);
  }

  copyPackage(packageName);
  const packageJson = readPackageJson(source);
  for (const dependencyName of Object.keys(packageJson.dependencies ?? {})) {
    copyPackageTree(dependencyName, copied);
  }
}

function pruneNodePtyRuntime() {
  const packageRoot = path.join(outputNodeModules, "node-pty");
  const prebuildsRoot = path.join(packageRoot, "prebuilds");
  for (const entry of fs.readdirSync(prebuildsRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== "win32-x64") {
      fs.rmSync(path.join(prebuildsRoot, entry.name), { recursive: true, force: true });
    }
  }

  for (const directory of ["deps", "scripts", "src", "third_party", "typings"]) {
    fs.rmSync(path.join(packageRoot, directory), { recursive: true, force: true });
  }

  // 交叉构建时 build/Release/pty.node 是宿主(Linux)产物，必须剔除，
  // 否则会随包进入 Windows 安装包并在加载时崩溃。
  if (process.platform !== "win32") {
    fs.rmSync(path.join(packageRoot, "build"), { recursive: true, force: true });
    console.log("Cross-build: removed host-built node-pty build/ directory");
  }

  for (const entry of fs.readdirSync(path.join(prebuildsRoot, "win32-x64"))) {
    if (entry.endsWith(".pdb")) {
      fs.rmSync(path.join(prebuildsRoot, "win32-x64", entry), { force: true });
    }
  }
  console.log("Pruned node-pty to the Windows x64 runtime files");
}

function writeBackendPackageJson() {
  const serverPackage = readPackageJson(__dirname);
  const sqliteVecPackageSource = resolveInstalledPackageSource("sqlite-vec");
  const sqliteVecPackage = sqliteVecPackageSource
    ? JSON.parse(
        fs.readFileSync(
          path.join(sqliteVecPackageSource, "package.json"),
          "utf-8",
        ),
      )
    : null;

  const backendPackage = {
    private: true,
    type: "commonjs",
    dependencies: {
      "better-sqlite3": serverPackage.dependencies["better-sqlite3"],
      jsdom: serverPackage.dependencies.jsdom,
      "playwright-core": serverPackage.dependencies["playwright-core"],
      sharp: serverPackage.dependencies.sharp,
      "sqlite-vec": serverPackage.dependencies["sqlite-vec"],
      "node-pty": serverPackage.dependencies["node-pty"],
      bindings: "^1.5.0",
      "file-uri-to-path": "^1.0.0",
      ...(sqliteVecPackage?.optionalDependencies ?? {}),
    },
  };

  fs.writeFileSync(
    path.join(outputDir, "package.json"),
    `${JSON.stringify(backendPackage, null, 2)}\n`,
  );
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(outputNodeModules, { recursive: true });
writeBackendPackageJson();
writeAppMetaJson();
copyToolsDir();
copySkillsDir();
copyStaticDir();

build({
  entryPoints: [path.join(__dirname, "src/index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(outputDir, "server.cjs"),
  absWorkingDir: __dirname,
  external: [
    "better-sqlite3",
    "jsdom",
    "playwright-core",
    "sharp",
    "sqlite-vec",
    "node-pty",
  ],
})
  .then(() => {
    console.log("Server bundle completed, copying native modules...");
    copyPackage("better-sqlite3");
    injectWin32BetterSqlite3();
    copyPackageTree("jsdom");
    copyPackage("playwright-core");
    copyPackage("sharp");
    copyPackage("detect-libc");
    copyPackage("semver");
    copyPackage("@img/colour");
    copyPackage("@img/sharp-win32-x64");
    copyPackage("sqlite-vec");
    copyPackage("sqlite-vec-windows-x64");
    copyPackageTree("node-pty");
    pruneNodePtyRuntime();
    copyPackage("bindings");
    copyPackage("file-uri-to-path");
    if (process.platform === "win32") {
      execFileSync(process.execPath, ["-e", "require('node-pty')"], {
        cwd: outputDir,
        stdio: "inherit",
      });
      console.log("Verified staged node-pty can load with the build Node runtime");
    } else {
      // 交叉构建（Linux -> Windows）：宿主无法 require Windows 版 pty.node。
      // 改为静态校验 win32-x64 预编译产物是否为 PE32+ 二进制。
      const winPty = path.join(
        outputNodeModules,
        "node-pty",
        "prebuilds",
        "win32-x64",
        "pty.node",
      );
      if (!fs.existsSync(winPty)) {
        throw new Error(`Missing Windows node-pty prebuild: ${winPty}`);
      }
      const header = fs.readFileSync(winPty).subarray(0, 2).toString("latin1");
      if (header !== "MZ") {
        throw new Error(`Staged node-pty is not a Windows PE binary: ${winPty}`);
      }
      console.log(
        "Cross-build: verified staged node-pty win32-x64 prebuild is a PE binary",
      );
    }
    console.log("Server build completed successfully");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
