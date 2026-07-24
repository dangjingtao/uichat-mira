import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

import { del, get, post, put } from "@/shared/lib/request";
import {
  deleteSkill,
  getSkillCatalog,
  getSkillDetail,
  getSkillFileContent,
  importSkillMarkdown,
  installSkillRuntime,
  updateSkill,
} from "../skills";

describe("skills api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the lightweight catalog from the canonical route", async () => {
    vi.mocked(get).mockResolvedValueOnce({ skills: [] });
    await getSkillCatalog();
    expect(get).toHaveBeenCalledWith("/skills/catalog");
  });

  it("loads detail and encodes nested file paths", async () => {
    vi.mocked(get).mockResolvedValue({});
    await getSkillDetail("my skill");
    expect(get).toHaveBeenCalledWith("/skills/my%20skill");

    await getSkillFileContent("my skill", "reference/示例.md");
    expect(get).toHaveBeenCalledWith("/skills/my%20skill/files/reference/%E7%A4%BA%E4%BE%8B.md");
  });

  it("imports, updates, deletes and installs runtime through /skills", async () => {
    vi.mocked(post).mockResolvedValue({});
    vi.mocked(put).mockResolvedValue({});
    vi.mocked(del).mockResolvedValue({ id: "demo" });

    const file = new File(["# Demo"], "SKILL.md", { type: "text/markdown" });
    await importSkillMarkdown(file);
    expect(post).toHaveBeenCalledWith("/skills/import", expect.any(FormData));

    await updateSkill("demo", { name: "Demo 2", featured: true });
    expect(put).toHaveBeenCalledWith("/skills/demo", { name: "Demo 2", featured: true });

    await deleteSkill("demo");
    expect(del).toHaveBeenCalledWith("/skills/demo");

    await installSkillRuntime("demo");
    expect(post).toHaveBeenCalledWith("/skills/demo/runtime/install", {});
  });
});
