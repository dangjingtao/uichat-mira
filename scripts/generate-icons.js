import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Jimp, ResizeStrategy } from "jimp";
import png2icons from "png2icons";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

function sampleBilinear(source, x, y) {
  const width = source.width;
  const height = source.height;
  const x1 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y1 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x2 = Math.max(0, Math.min(width - 1, x1 + 1));
  const y2 = Math.max(0, Math.min(height - 1, y1 + 1));
  const tx = x - x1;
  const ty = y - y1;

  const i11 = (y1 * width + x1) * 4;
  const i21 = (y1 * width + x2) * 4;
  const i12 = (y2 * width + x1) * 4;
  const i22 = (y2 * width + x2) * 4;

  const out = new Uint8Array(4);
  for (let channel = 0; channel < 4; channel += 1) {
    const a = source.data[i11 + channel] * (1 - tx) + source.data[i21 + channel] * tx;
    const b = source.data[i12 + channel] * (1 - tx) + source.data[i22 + channel] * tx;
    out[channel] = Math.round(a * (1 - ty) + b * ty);
  }
  return out;
}

function resizeContain(source, size) {
  const canvas = new Uint8Array(size * size * 4);
  const scale = Math.min(size / source.width, size / source.height);
  const resizedWidth = Math.max(1, Math.round(source.width * scale));
  const resizedHeight = Math.max(1, Math.round(source.height * scale));
  const offsetX = Math.floor((size - resizedWidth) / 2);
  const offsetY = Math.floor((size - resizedHeight) / 2);
  const xRatio = source.width / resizedWidth;
  const yRatio = source.height / resizedHeight;

  for (let y = 0; y < resizedHeight; y += 1) {
    const sourceY = (y + 0.5) * yRatio - 0.5;
    for (let x = 0; x < resizedWidth; x += 1) {
      const sourceX = (x + 0.5) * xRatio - 0.5;
      const pixel = sampleBilinear(source, sourceX, sourceY);
      const destIndex = ((y + offsetY) * size + (x + offsetX)) * 4;
      canvas[destIndex] = pixel[0];
      canvas[destIndex + 1] = pixel[1];
      canvas[destIndex + 2] = pixel[2];
      canvas[destIndex + 3] = pixel[3];
    }
  }

  return canvas;
}

async function writePngFromRgba(rgba, size, outputPath) {
  const image = new Jimp({ width: size, height: size, color: 0x00000000 });
  image.bitmap.data = Buffer.from(rgba);
  const pngBuffer = await image.getBuffer("image/png");
  fs.writeFileSync(outputPath, pngBuffer);
}

export async function generateDesktopIcons(rootDir, sourceIconPath) {
  if (!fs.existsSync(sourceIconPath)) {
    throw new Error(`Missing branding source icon: ${sourceIconPath}`);
  }

  const iconsDir = path.join(rootDir, "icons");
  fs.mkdirSync(iconsDir, { recursive: true });

  const source = await Jimp.read(sourceIconPath);
  const sourceBitmap = {
    width: source.bitmap.width,
    height: source.bitmap.height,
    data: source.bitmap.data,
  };

  const icon1024 = resizeContain(sourceBitmap, 1024);
  const icon512 = resizeContain(sourceBitmap, 512);

  await writePngFromRgba(icon1024, 1024, path.join(iconsDir, "icon_1024.png"));
  await writePngFromRgba(icon512, 512, path.join(iconsDir, "icon_512.png"));

  const iconImage = new Jimp({ width: 512, height: 512, color: 0x00000000 });
  iconImage.bitmap.data = Buffer.from(icon512);
  const iconBuffer = await iconImage.getBuffer("image/png");
  const ico = png2icons.createICO(iconBuffer, png2icons.BICUBIC2, 0, false, true);
  const icns = png2icons.createICNS(iconBuffer, png2icons.BICUBIC2, 0);

  if (!ico) {
    throw new Error("Failed to generate icon.ico");
  }

  if (!icns) {
    throw new Error("Failed to generate icon.icns");
  }

  fs.writeFileSync(path.join(iconsDir, "icon.ico"), ico);
  fs.writeFileSync(path.join(iconsDir, "icon.icns"), icns);
  console.log(`Generated icons in ${iconsDir}`);
}
