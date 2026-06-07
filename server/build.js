import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const outputDir = path.join(projectRoot, "electron", "backend");
const outputNodeModules = path.join(outputDir, "node_modules");

function readPackageJson(packageDir) {
  return JSON.parse(
    fs.readFileSync(path.join(packageDir, "package.json"), "utf-8"),
  );
}

function copyPackage(packageName) {
  const serverPackage = readPackageJson(__dirname);
  const version = serverPackage.dependencies?.[packageName];

  const pnpmStore = path.join(projectRoot, "node_modules", ".pnpm");
  const packageDirName = fs
    .readdirSync(pnpmStore)
    .find((name) => name.startsWith(`${packageName}@`));

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
  const backendPackage = {
    private: true,
    type: "commonjs",
    dependencies: {
      "better-sqlite3": serverPackage.dependencies["better-sqlite3"],
      bindings: "^1.5.0",
      "file-uri-to-path": "^1.0.0",
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

build({
  entryPoints: [path.join(__dirname, "src/index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(outputDir, "server.cjs"),
  absWorkingDir: __dirname,
  external: ["better-sqlite3"],
})
  .then(() => {
    console.log("Server bundle completed, copying native modules...");
    copyPackage("better-sqlite3");
    copyPackage("bindings");
    copyPackage("file-uri-to-path");
    console.log("Server build completed successfully");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
