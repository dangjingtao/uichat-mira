import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveWenshuRuntimeScript,
  type WenshuPythonScript,
} from "./python-runtime.js";
import {
  buildWenshuPythonEnv,
  resolveWenshuOfficeSitePackages,
} from "./runtime-pack-paths.js";

const scripts: WenshuPythonScript[] = [
  "pdf/pdf_create_runtime.py",
  "pdf/pdf_runtime.py",
  "pptx/pptx_runtime.py",
  "xlsx/xlsx_finalize.py",
  "xlsx/xlsx_runtime.py",
  "xlsx/xlsx_tools.py",
];

describe("WenShu Python invocation contract", () => {
  it("resolves every supported runtime script through the WenShu tool root", () => {
    for (const script of scripts) {
      const resolved = resolveWenshuRuntimeScript(script);
      expect(path.isAbsolute(resolved)).toBe(true);
      expect(fs.existsSync(resolved)).toBe(true);
      expect(resolved.replaceAll("\\", "/")).toContain(`/wenshu/${script}`);
    }
  });

  it("injects the managed Runtime Pack site-packages before inherited paths", () => {
    const sitePackages = resolveWenshuOfficeSitePackages();
    const env = buildWenshuPythonEnv(sitePackages);
    expect(env.PYTHONPATH?.split(path.delimiter)[0]).toBe(sitePackages);
    expect(env.PYTHONUTF8).toBe("1");
    expect(env.PYTHONIOENCODING).toBe("utf-8");
  });
});
