import type { FastifyPluginAsync } from "fastify";
import {
  getWenshuCapabilityPackStatus,
  installWenshuCapabilityPack,
  isWenshuCapabilityPackProvisioned,
} from "@/microapps/office-suite/capability-pack.js";
import {
  getSkillCatalogDetail,
  getSkillCatalogFileContent,
  listSkillCatalogSummaries,
  type SkillCatalogSummary,
} from "@/skills/catalog.js";
import { getDefaultSkillContextProvider } from "@/skills/context/provider.js";
import { getDefaultSkillRegistry } from "@/skills/context/scanner.js";
import {
  deleteUserSkill,
  importMarkdownSkill,
  updateUserSkill,
  type UpdateUserSkillInput,
} from "@/skills/user-skills.js";
import { success } from "@/utils/index.js";
import { badRequest, notFound, routeHandler } from "@/utils/route-errors.js";

const MAX_SKILL_MARKDOWN_BYTES = 512 * 1024;
const WENSHU_RUNTIME_PREFIX = "wenshu-office@";

export type SkillRuntimeDisplayStatus =
  | "not-required"
  | "not-installed"
  | "available"
  | "broken"
  | "unknown";

type RuntimeSnapshot = {
  status: Exclude<SkillRuntimeDisplayStatus, "not-required" | "unknown">;
  missing: string[];
  error?: string;
};

const loadWenshuRuntimeSnapshot = async (): Promise<RuntimeSnapshot> => {
  try {
    const status = await getWenshuCapabilityPackStatus();
    if (status.installed && status.missing.length === 0 && !status.error) {
      return { status: "available", missing: [] };
    }
    const provisioned = isWenshuCapabilityPackProvisioned();
    if (provisioned || status.error) {
      return {
        status: "broken",
        missing: [...status.missing],
        ...(status.error ? { error: status.error } : {}),
      };
    }
    return { status: "not-installed", missing: [...status.missing] };
  } catch (error) {
    return {
      status: "broken",
      missing: [],
      error: error instanceof Error ? error.message : "Runtime status probe failed",
    };
  }
};

const runtimeRequirementKind = (requirements: string[]) => {
  if (requirements.length === 0) return "none" as const;
  if (requirements.some((requirement) => requirement.startsWith(WENSHU_RUNTIME_PREFIX))) {
    return "wenshu-office" as const;
  }
  return "unknown" as const;
};

const withRuntimeStatus = (
  skill: SkillCatalogSummary,
  snapshot?: RuntimeSnapshot,
) => {
  const kind = runtimeRequirementKind(skill.runtimeRequirements);
  if (kind === "none") {
    return {
      ...skill,
      runtime: {
        requirements: [] as string[],
        status: "not-required" as const,
      },
    };
  }
  if (kind === "unknown" || !snapshot) {
    return {
      ...skill,
      runtime: {
        requirements: [...skill.runtimeRequirements],
        status: "unknown" as const,
      },
    };
  }
  return {
    ...skill,
    runtime: {
      requirements: [...skill.runtimeRequirements],
      status: snapshot.status,
      ...(snapshot.missing.length ? { missing: [...snapshot.missing] } : {}),
      ...(snapshot.error ? { error: snapshot.error } : {}),
    },
  };
};

const resolveRuntimeSnapshot = async (skills: SkillCatalogSummary[]) =>
  skills.some((skill) => runtimeRequirementKind(skill.runtimeRequirements) === "wenshu-office")
    ? await loadWenshuRuntimeSnapshot()
    : undefined;

const invalidateSkillDiscovery = () => {
  getDefaultSkillRegistry().invalidate();
  getDefaultSkillContextProvider().invalidate();
};

const skillsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/skills/catalog",
    routeHandler("Failed to list Skill catalog", async () => {
      const skills = await listSkillCatalogSummaries();
      const runtimeSnapshot = await resolveRuntimeSnapshot(skills);
      return success(
        { skills: skills.map((skill) => withRuntimeStatus(skill, runtimeSnapshot)) },
        "Skill catalog",
      );
    }),
  );

  app.post(
    "/skills/import",
    routeHandler("Failed to import Markdown Skill", async (request) => {
      const upload = await request.file({
        limits: {
          files: 1,
          fileSize: MAX_SKILL_MARKDOWN_BYTES,
        },
      });
      if (!upload) throw badRequest("请选择一个 Markdown 文件");
      if (!upload.filename.toLowerCase().endsWith(".md")) {
        throw badRequest("当前只支持导入 .md / SKILL.md 文件");
      }
      const buffer = await upload.toBuffer();
      if (buffer.byteLength === 0) throw badRequest("Markdown 文件内容为空");
      try {
        const imported = await importMarkdownSkill({
          fileName: upload.filename,
          content: buffer.toString("utf8"),
        });
        invalidateSkillDiscovery();
        const detail = await getSkillCatalogDetail(imported.id);
        if (!detail) throw new Error("Imported Skill could not be rediscovered");
        return success(withRuntimeStatus(detail), `Skill「${imported.name}」已添加`);
      } catch (error) {
        throw badRequest(error instanceof Error ? error.message : "Markdown Skill 导入失败");
      }
    }),
  );

  app.get<{ Params: { id: string } }>(
    "/skills/:id",
    routeHandler<{ Params: { id: string } }>("Failed to load Skill detail", async (request) => {
      const detail = await getSkillCatalogDetail(request.params.id);
      if (!detail) throw notFound(`Skill not found: ${request.params.id}`);
      const runtimeSnapshot = await resolveRuntimeSnapshot([detail]);
      return success(withRuntimeStatus(detail, runtimeSnapshot), "Skill detail");
    }),
  );

  app.get<{ Params: { id: string; "*": string } }>(
    "/skills/:id/files/*",
    routeHandler<{ Params: { id: string; "*": string } }>(
      "Failed to load Skill file",
      async (request) => {
        const relativePath = request.params["*"];
        const content = await getSkillCatalogFileContent(request.params.id, relativePath);
        if (!content) {
          throw notFound(`Skill file not found: ${request.params.id}/${relativePath}`);
        }
        return success(content, "Skill file content");
      },
    ),
  );

  app.put<{ Params: { id: string }; Body: UpdateUserSkillInput }>(
    "/skills/:id",
    routeHandler<{ Params: { id: string }; Body: UpdateUserSkillInput }>(
      "Failed to update Skill",
      async (request) => {
        const registry = getDefaultSkillRegistry();
        await registry.refresh();
        const manifest = registry.get(request.params.id);
        if (!manifest) throw notFound(`Skill not found: ${request.params.id}`);
        try {
          await updateUserSkill(manifest.entry, request.body ?? {});
        } catch (error) {
          throw badRequest(error instanceof Error ? error.message : "Skill 更新失败");
        }
        invalidateSkillDiscovery();
        const detail = await getSkillCatalogDetail(request.params.id);
        if (!detail) throw new Error("Updated Skill could not be rediscovered");
        const runtimeSnapshot = await resolveRuntimeSnapshot([detail]);
        return success(withRuntimeStatus(detail, runtimeSnapshot), "Skill updated");
      },
    ),
  );

  app.delete<{ Params: { id: string } }>(
    "/skills/:id",
    routeHandler<{ Params: { id: string } }>("Failed to delete Skill", async (request) => {
      const registry = getDefaultSkillRegistry();
      await registry.refresh();
      const manifest = registry.get(request.params.id);
      if (!manifest) throw notFound(`Skill not found: ${request.params.id}`);
      try {
        await deleteUserSkill(manifest.entry);
      } catch (error) {
        throw badRequest(error instanceof Error ? error.message : "Skill 删除失败");
      }
      invalidateSkillDiscovery();
      return success({ id: request.params.id }, "Skill deleted");
    }),
  );

  app.post<{ Params: { id: string } }>(
    "/skills/:id/runtime/install",
    routeHandler<{ Params: { id: string } }>(
      "Failed to install Skill runtime",
      async (request) => {
        const detail = await getSkillCatalogDetail(request.params.id);
        if (!detail) throw notFound(`Skill not found: ${request.params.id}`);
        const kind = runtimeRequirementKind(detail.runtimeRequirements);
        if (kind === "none") {
          return success(withRuntimeStatus(detail), "Skill does not require a runtime pack");
        }
        if (kind !== "wenshu-office") {
          throw badRequest(`Unsupported Skill runtime requirement: ${detail.runtimeRequirements.join(", ")}`);
        }
        await installWenshuCapabilityPack();
        const runtimeSnapshot = await loadWenshuRuntimeSnapshot();
        return success(withRuntimeStatus(detail, runtimeSnapshot), "Skill runtime installed");
      },
    ),
  );
};

export default skillsRoutes;
