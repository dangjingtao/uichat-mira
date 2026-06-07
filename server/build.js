import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 动态读取依赖版本
function getNativeModuleVersions() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, "package.json"), "utf-8"),
  );
  return {
    sqlite3: pkg.dependencies.sqlite3,
    sqlite: pkg.dependencies.sqlite,
  };
}

// 复制原生模块到输出目录
function copyNativeModules(outputDir, versions) {
  const rootNodeModules = path.join(__dirname, "..", "..", "node_modules");
  const targetNodeModules = path.join(outputDir, "node_modules");

  if (!fs.existsSync(targetNodeModules)) {
    fs.mkdirSync(targetNodeModules, { recursive: true });
  }

  const modulesToCopy = [
    { name: "sqlite3", version: versions.sqlite3 },
    { name: "sqlite", version: versions.sqlite },
  ];

  for (const { name, version } of modulesToCopy) {
    const modulePnpmDir = path.join(
      rootNodeModules,
      ".pnpm",
      `${name}@${version}`,
    );
    if (fs.existsSync(modulePnpmDir)) {
      const moduleTargetDir = path.join(
        targetNodeModules,
        ".pnpm",
        `${name}@${version}`,
      );
      if (!fs.existsSync(moduleTargetDir)) {
        fs.mkdirSync(moduleTargetDir, { recursive: true });
      }

      const srcPath = path.join(modulePnpmDir, `node_modules/${name}`);
      const destPath = path.join(moduleTargetDir, `node_modules/${name}`);

      if (fs.existsSync(srcPath)) {
        copyDir(srcPath, destPath);
        console.log(`Copied ${name}`);
      }
    }
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "bindings") {
        console.log(`Skipping bindings directory`);
        continue;
      }
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const versions = getNativeModuleVersions();
const outputDir = path.join(__dirname, "..", "electron", "backend");

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

build({
  entryPoints: [path.join(__dirname, "src/index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(outputDir, "server.cjs"),
  absWorkingDir: __dirname,
  external: ["sqlite3", "sqlite", "better-sqlite3"],
})
  .then(() => {
    console.log("Build completed, copying native modules...");
    copyNativeModules(outputDir, versions);
    console.log("Native modules copied successfully");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
