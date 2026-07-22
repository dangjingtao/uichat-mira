import type { FastifyInstance } from "fastify";
import {
  getWenshuCapabilityPackStatus,
  installWenshuCapabilityPack,
} from "@/microapps/office-suite/capability-pack.js";
import { listBuiltInSkillPackages } from "@/skills/registry.js";
import { success } from "@/utils/index.js";
import { routeHandler } from "@/utils/route-errors.js";

export const registerWenshuCapabilityPackRoutes = async (app: FastifyInstance) => {
  app.get(
    "/microapps/office-suite/skills/catalog",
    routeHandler("Failed to list WenShu Skill packages", async () =>
      success(
        {
          skills: listBuiltInSkillPackages(),
          pack: await getWenshuCapabilityPackStatus(),
        },
        "WenShu Skill package catalog",
      ),
    ),
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
