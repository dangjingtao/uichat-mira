// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillCatalogItem, SkillDetail } from "@/shared/api/skills";
import SkillsSettings from "./index";

const api = vi.hoisted(() => ({
  deleteSkill: vi.fn(),
  getSkillCatalog: vi.fn(),
  getSkillDetail: vi.fn(),
  getSkillFileContent: vi.fn(),
  importSkillMarkdown: vi.fn(),
  installSkillRuntime: vi.fn(),
  updateSkill: vi.fn(),
}));

vi.mock("@/shared/api/skills", () => api);
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const createSkill = (
  status: SkillCatalogItem["runtime"]["status"],
): SkillCatalogItem => ({
  id: "xlsx",
  version: "1.0.0",
  name: "Spreadsheet Skill",
  source: "UIChat Mira",
  category: "办公效率",
  description: "Create and edit spreadsheets.",
  origin: "built-in",
  featured: true,
  runtimeRequirements: ["wenshu-office@1"],
  runtime: {
    requirements: ["wenshu-office@1"],
    status,
  },
});

const createDetail = (
  status: SkillCatalogItem["runtime"]["status"],
): SkillDetail => ({
  ...createSkill(status),
  files: [],
});

const openDetail = async () => {
  const user = userEvent.setup();
  render(<SkillsSettings />);
  await user.click(await screen.findByRole("button", { name: /Spreadsheet Skill/ }));
  await screen.findByRole("button", { name: "关闭" });
  return user;
};

describe("SkillsSettings detail actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show use or uninstall actions for an available skill", async () => {
    const skill = createSkill("available");
    api.getSkillCatalog.mockResolvedValue({ skills: [skill] });
    api.getSkillDetail.mockResolvedValue(createDetail("available"));

    await openDetail();

    expect(screen.queryByRole("button", { name: "去使用" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "安装" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "卸载" })).not.toBeInTheDocument();
  });

  it("installs a missing runtime and hides the action after success", async () => {
    const missingSkill = createSkill("not-installed");
    const installedDetail = createDetail("available");
    api.getSkillCatalog
      .mockResolvedValueOnce({ skills: [missingSkill] })
      .mockResolvedValueOnce({ skills: [createSkill("available")] });
    api.getSkillDetail.mockResolvedValue(createDetail("not-installed"));
    api.installSkillRuntime.mockResolvedValue(installedDetail);

    const user = await openDetail();
    await user.click(screen.getByRole("button", { name: "安装" }));

    await waitFor(() => expect(api.installSkillRuntime).toHaveBeenCalledWith("xlsx"));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "安装" })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "去使用" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "卸载" })).not.toBeInTheDocument();
  });
});
