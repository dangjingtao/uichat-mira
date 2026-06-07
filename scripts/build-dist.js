import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

// 获取版本号
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"),
);
const version = packageJson.version;

// 生成日期标识（YYYYMMDD）
const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

// 输出目录名
const outputDir = `v${version}_${date}`;

console.log(`Building version: ${version}`);
console.log(`Output directory: ${outputDir}`);

// 创建输出目录
const fullOutputPath = path.join(projectRoot, "release", outputDir);
if (!fs.existsSync(fullOutputPath)) {
  fs.mkdirSync(fullOutputPath, { recursive: true });
}

// 清理 electron 目录下的旧构建产物
console.log("\n=== Cleaning up old build artifacts ===");
const electronDistPath = path.join(projectRoot, "electron", "dist");
if (fs.existsSync(electronDistPath)) {
  fs.rmSync(electronDistPath, { recursive: true, force: true });
  console.log(`✓ Removed: ${electronDistPath}`);
} else {
  console.log(`✓ No old artifacts to clean in electron/dist`);
}

try {
  // 先构建所有组件
  console.log("\n=== Building components ===");
  execSync("pnpm build", { stdio: "inherit", cwd: projectRoot });

  // 然后使用 electron-builder 打包
  console.log("\n=== Packaging with electron-builder ===");

  // 使用相对路径（相对于 electron 目录）
  const relativeOutputPath = path.relative(
    path.join(projectRoot, "electron"),
    fullOutputPath,
  );
  const buildCmd = `electron-builder --win --config.directories.output="${relativeOutputPath}" --publish never`;

  console.log(
    `Running in electron directory with output: ${relativeOutputPath}`,
  );
  execSync(buildCmd, {
    stdio: "inherit",
    cwd: path.join(projectRoot, "electron"),
  });

  console.log(`\n✓ Build completed successfully!`);
  console.log(`✓ Output directory: ${fullOutputPath}`);

  // 清理 electron 目录下的打包产物
  console.log("\n=== Cleaning up temporary build artifacts ===");
  const electronBackendPath = path.join(projectRoot, "electron", "backend");
  if (fs.existsSync(electronBackendPath)) {
    fs.rmSync(electronBackendPath, { recursive: true, force: true });
    console.log(`✓ Removed: ${electronBackendPath}`);
  } else {
    console.log(`✓ No temporary artifacts to clean in electron/backend`);
  }

  const electronDistPath = path.join(projectRoot, "electron", "dist");
  if (fs.existsSync(electronDistPath)) {
    fs.rmSync(electronDistPath, { recursive: true, force: true });
    console.log(`✓ Removed: ${electronDistPath}`);
  } else {
    console.log(`✓ No temporary artifacts to clean in electron/dist`);
  }

  console.log("\n✓ All done!");
} catch (error) {
  console.error("Build failed:", error.message);
  process.exit(1);
}
