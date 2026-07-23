import { isWenshuCapabilityPackProvisioned } from "@/microapps/office-suite/capability-pack.js";
import { officePdfTool } from "@/mcp/tools/office-pdf.tool.js";
import { officePresentationTool } from "@/mcp/tools/office-presentation.tool.js";
import { officeSpreadsheetTool } from "@/mcp/tools/office-spreadsheet.tool.js";
import {
  listCapabilityDefinitions,
  registerCapability,
  unregisterCapability,
} from "./registry.js";

const WENSHU_OPTIONAL_CAPABILITIES = [
  officePdfTool,
  officeSpreadsheetTool,
  officePresentationTool,
] as const;

export const WENSHU_OPTIONAL_CAPABILITY_IDS = WENSHU_OPTIONAL_CAPABILITIES.map(
  (capability) => capability.definition.id,
);

/**
 * Keep optional WenShu execution capabilities aligned with environment truth.
 *
 * This is deliberately independent from Skill matching. A Skill may be matched
 * without these capabilities being available, and capability registration must
 * never depend on the active SkillContext.
 */
export const reconcileWenshuOfficeHarnessCapabilities = () => {
  const available = isWenshuCapabilityPackProvisioned();
  const registered = new Set(listCapabilityDefinitions().map((definition) => definition.id));

  for (const capability of WENSHU_OPTIONAL_CAPABILITIES) {
    const id = capability.definition.id;
    if (available) {
      if (!registered.has(id)) registerCapability(capability);
      continue;
    }
    if (registered.has(id)) unregisterCapability(id);
  }

  return {
    runtimePackAvailable: available,
    capabilityIds: [...WENSHU_OPTIONAL_CAPABILITY_IDS],
    registeredCapabilityIds: available ? [...WENSHU_OPTIONAL_CAPABILITY_IDS] : [],
  };
};
