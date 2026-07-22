import fs from "node:fs";
import path from "node:path";

const requiredComponents = ["node", "npm", "npx", "git", "uv", "ripgrep"];

export function stageTerminalDevRuntime({ artifactsRoot, destinationRoot }) {
  const sourceNodeRoot = path.join(artifactsRoot, "node-runtime");
  const sourceTerminalRoot = path.join(artifactsRoot, "terminal-runtime");
  const sourceManifestPath = path.join(sourceTerminalRoot, "manifest.json");
  for (const requiredPath of [sourceNodeRoot, sourceTerminalRoot, sourceManifestPath]) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(`Missing prepared Terminal Dev Runtime input: ${requiredPath}`);
    }
  }

  const destinationNodeRoot = path.join(destinationRoot, "node-runtime");
  const destinationTerminalRoot = path.join(destinationRoot, "terminal-runtime");
  fs.rmSync(destinationNodeRoot, { recursive: true, force: true });
  fs.rmSync(destinationTerminalRoot, { recursive: true, force: true });
  fs.mkdirSync(destinationRoot, { recursive: true });
  fs.cpSync(sourceNodeRoot, destinationNodeRoot, { recursive: true });
  fs.cpSync(sourceTerminalRoot, destinationTerminalRoot, { recursive: true });

  const manifest = JSON.parse(
    fs.readFileSync(path.join(destinationTerminalRoot, "manifest.json"), "utf8"),
  );
  for (const componentName of requiredComponents) {
    const component = manifest.components?.[componentName];
    if (!component?.runtimePath) {
      throw new Error(`Staged runtime manifest is missing component: ${componentName}`);
    }
    const executablePath = path.resolve(destinationRoot, component.runtimePath);
    if (!fs.existsSync(executablePath)) {
      throw new Error(`Staged ${componentName} executable is missing: ${executablePath}`);
    }
  }

  console.log(`Staged shared Node and Terminal Dev Runtime: ${destinationRoot}`);
  return manifest;
}
