import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

function runPython(script) {
  const result = spawnSync("python", ["-c", script], {
    cwd: projectRoot,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to generate icons");
  }

  return result.stdout.trim();
}

export function generateDesktopIcons(rootDir, sourceIconPath) {
  if (!fs.existsSync(sourceIconPath)) {
    throw new Error(`Missing branding source icon: ${sourceIconPath}`);
  }

  const script = String.raw`
from pathlib import Path
from PIL import Image, ImageOps

root = Path(r"${rootDir.replace(/\\/g, "\\\\")}")
source = Path(r"${sourceIconPath.replace(/\\/g, "\\\\")}")
icons_dir = root / "icons"
icons_dir.mkdir(parents=True, exist_ok=True)

img = Image.open(source).convert("RGBA")

def contain_to(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    resized = ImageOps.contain(img, (size, size), Image.Resampling.LANCZOS)
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas

for size, name in [(1024, "icon_1024.png"), (512, "icon_512.png")]:
    contain_to(size).save(icons_dir / name)

base = contain_to(512)
base.save(icons_dir / "icon.ico", sizes=[(s, s) for s in [16, 24, 32, 48, 64, 128, 256, 512]])
base.save(icons_dir / "icon.icns")
print(f"Generated icons in {icons_dir}")
`;

  runPython(script);
}

