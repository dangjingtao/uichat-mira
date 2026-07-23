import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { writeStructuredLog } from "@/logger";

const existingPath = (value: string | undefined) => {
  const candidate = value?.trim();
  return candidate && fs.existsSync(candidate) ? candidate : undefined;
};

const resolveChromiumExecutable = () => {
  const configured =
    existingPath(process.env.MIRA_CHROMIUM_EXECUTABLE_PATH) ??
    existingPath(process.env.CHROME_PATH) ??
    existingPath(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH);
  if (configured) return configured;

  const candidates =
    process.platform === "win32"
      ? [
          process.env.LOCALAPPDATA
            ? path.join(
                process.env.LOCALAPPDATA,
                "Google",
                "Chrome",
                "Application",
                "chrome.exe",
              )
            : "",
          process.env.PROGRAMFILES
            ? path.join(
                process.env.PROGRAMFILES,
                "Google",
                "Chrome",
                "Application",
                "chrome.exe",
              )
            : "",
          process.env["PROGRAMFILES(X86)"]
            ? path.join(
                process.env["PROGRAMFILES(X86)"]!,
                "Google",
                "Chrome",
                "Application",
                "chrome.exe",
              )
            : "",
          process.env.PROGRAMFILES
            ? path.join(
                process.env.PROGRAMFILES,
                "Microsoft",
                "Edge",
                "Application",
                "msedge.exe",
              )
            : "",
          process.env["PROGRAMFILES(X86)"]
            ? path.join(
                process.env["PROGRAMFILES(X86)"]!,
                "Microsoft",
                "Edge",
                "Application",
                "msedge.exe",
              )
            : "",
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/microsoft-edge",
          ];

  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
};

export const renderHtmlReportToPdf = async (input: {
  html: string;
  outputPath: string;
}) => {
  const executablePath = resolveChromiumExecutable();
  if (!executablePath) {
    throw new Error(
      "No local Chromium-compatible browser found. Install Chrome/Edge or set MIRA_CHROMIUM_EXECUTABLE_PATH.",
    );
  }

  fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
  const startedAt = Date.now();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--disable-gpu"],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
    });
    await page.setContent(input.html, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: input.outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "10mm",
        right: "10mm",
        bottom: "12mm",
        left: "10mm",
      },
    });

    writeStructuredLog("info", {
      scope: "skill-report-pdf",
      event: "html-to-pdf-completed",
      executablePath,
      outputPath: input.outputPath,
      durationMs: Date.now() - startedAt,
    });
    return input.outputPath;
  } finally {
    await browser.close();
  }
};
