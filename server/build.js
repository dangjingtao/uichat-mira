import { build } from "esbuild";
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

function copyStaticDir() {
  const staticSource = path.join(__dirname, "static");
  const staticDest = path.join(outputDir, "static");
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

  fs.copyFileSync(brandingLogoSource, path.join(staticDest, "logo.png"));
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

  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true, dereference: true });
  console.log(`Copied native package ${packageName}`);
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
      "playwright-core": serverPackage.dependencies["playwright-core"],
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
copyStaticDir();

build({
  entryPoints: [path.join(__dirname, "src/index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(outputDir, "server.cjs"),
  absWorkingDir: __dirname,
  external: ["better-sqlite3", "playwright-core", "sqlite-vec"],
})
  .then(() => {
    console.log("Server bundle completed, copying native modules...");
    copyPackage("better-sqlite3");
    copyPackage("playwright-core");
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
