import type { FastifyInstance } from "fastify";
import {
  getWenshuCapabilityPackStatus,
  installWenshuCapabilityPack,
} from "@/microapps/office-suite/capability-pack.js";
import { listSkillCatalogPackages } from "@/skills/catalog.js";
import { getDefaultSkillContextProvider } from "@/skills/context/provider.js";
import { importMarkdownSkill } from "@/skills/user-skills.js";
import { success } from "@/utils/index.js";
import { badRequest, routeHandler } from "@/utils/route-errors.js";
import skillsRoutes from "../../skills/index.js";

const MAX_SKILL_MARKDOWN_BYTES = 512 * 1024;

export const registerWenshuCapabilityPackRoutes = async (app: FastifyInstance) => {
  // Canonical Skill presentation/management API is owned by routes/skills.
  // It is registered here only because the current server composition groups
  // settings routes under the micro-app router; callers use /skills/* paths.
  await app.register(skillsRoutes);

  // Legacy dev compatibility. New UI code must use /skills/*.
  app.get(
    "/microapps/office-suite/skills/catalog",
    routeHandler("Failed to list Skill packages", async () =>
      success(
        {
          skills: await listSkillCatalogPackages(),
          pack: await getWenshuCapabilityPackStatus(),
        },
        "Skill package catalog",
      ),
    ),
  );

  app.post(
    "/microapps/office-suite/skills/import",
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
        getDefaultSkillContextProvider().invalidate();
        return success(imported, `Skill「${imported.name}」已生成并添加`);
      } catch (error) {
        throw badRequest(error instanceof Error ? error.message : "Markdown Skill 导入失败");
      }
    }),
  );

  app.get(
    "/microapps/office-suite/capability-pack/status",
    routeHandler("Failed to inspect WenShu capability pack", async () =>
      success(await getWenshuCapabilityPackStatus(), "WenShu capability pack status"),
    ),
  );

  app.post(
    "/microapps/office-suite/capability-pack/install",
    routeHandler("Failed to install WenShu capability pack", async () =>
      success(await installWenshuCapabilityPack(), "WenShu capability pack installed"),
    ),
  );
};
