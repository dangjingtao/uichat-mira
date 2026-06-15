import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const outputDir = path.join(projectRoot, ".artifacts", "server-bundle");
const outputNodeModules = path.join(outputDir, "node_modules");
const pnpmStore = path.join(projectRoot, "node_modules", ".pnpm");

function readPackageJson(packageDir) {
  return JSON.parse(
    fs.readFileSync(path.join(packageDir, "package.json"), "utf-8"),
  );
}

function writeAppMetaJson() {
  const rootPackage = readPackageJson(projectRoot);
  const appMeta = {
    name:
      typeof rootPackage.name === "string"
        ? rootPackage.name
        : "ui-chat-rag-tester",
    version:
      typeof rootPackage.version === "string" ? rootPackage.version : "0.0.0",
    author: typeof rootPackage.author === "string" ? rootPackage.author : "",
    description:
      typeof rootPackage.description === "string" ? rootPackage.description : "",
    repository: rootPackage.repository ?? null,
    homepage:
      typeof rootPackage.homepage === "string" ? rootPackage.homepage : "",
    appMeta:
      rootPackage.appMeta && typeof rootPackage.appMeta === "object"
        ? rootPackage.appMeta
        : {},
  };

  fs.writeFileSync(
    path.join(outputDir, "app-meta.json"),
    `${JSON.stringify(appMeta, null, 2)}\n`,
  );
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

function resolveInstalledPackageDir(packageName) {
  return fs
    .readdirSync(pnpmStore)
    .find((name) => name.startsWith(`${packageName}@`));
}

function copyPackage(packageName) {
  const serverPackage = readPackageJson(__dirname);
  const version = serverPackage.dependencies?.[packageName];
  const packageDirName = resolveInstalledPackageDir(packageName);

  if (!packageDirName) {
    const suffix = version ? `@${version}` : "";
    throw new Error(`Cannot find installed pnpm package for ${packageName}${suffix}`);
  }

  const source = path.join(pnpmStore, packageDirName, "node_modules", packageName);
  const destination = path.join(outputNodeModules, packageName);

  if (!fs.existsSync(source)) {
    throw new Error(`Cannot find package ${packageName} at ${source}`);
  }

  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true, dereference: true });
  console.log(`Copied native package ${packageName}`);
}

function writeBackendPackageJson() {
  const serverPackage = readPackageJson(__dirname);
  const sqliteVecPackageDirName = resolveInstalledPackageDir("sqlite-vec");
  const sqliteVecPackage = sqliteVecPackageDirName
    ? JSON.parse(
        fs.readFileSync(
          path.join(
            pnpmStore,
            sqliteVecPackageDirName,
            "node_modules",
            "sqlite-vec",
            "package.json",
          ),
          "utf-8",
        ),
      )
    : null;

  const backendPackage = {
    private: true,
    type: "commonjs",
    dependencies: {
      "better-sqlite3": serverPackage.dependencies["better-sqlite3"],
      "sqlite-vec": serverPackage.dependencies["sqlite-vec"],
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

build({
  entryPoints: [path.join(__dirname, "src/index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(outputDir, "server.cjs"),
  absWorkingDir: __dirname,
  external: ["better-sqlite3", "sqlite-vec"],
})
  .then(() => {
    console.log("Server bundle completed, copying native modules...");
    copyPackage("better-sqlite3");
    copyPackage("sqlite-vec");
    copyPackage("sqlite-vec-windows-x64");
    copyPackage("bindings");
    copyPackage("file-uri-to-path");
    console.log("Server build completed successfully");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
