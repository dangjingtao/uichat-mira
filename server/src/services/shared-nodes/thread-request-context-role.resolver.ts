import { roleService } from "@/services/role.service.js";
import type {
  RequestContextMessage,
  RequestContextResolver,
} from "./thread-request-context.types.js";

/**
 * Builds the role prompt body from the persisted Role entity.
 *
 * The important boundary here is:
 * - Role CRUD stores structured prompt fragments
 * - This resolver flattens them into one request-only system message
 * - Chat history itself remains clean and visible-only
 */
const buildRolePromptContent = (
  roleId: string,
  userId: number,
): string | null => {
  const role = roleService.getRoleById(roleId, userId);
  if (!role) {
    return null;
  }

  const sections = [
    role.prompt.description.trim()
      ? `角色描述：\n${role.prompt.description.trim()}`
      : null,
    role.prompt.worldview.trim()
      ? `世界观：\n${role.prompt.worldview.trim()}`
      : null,
    role.prompt.persona.trim()
      ? `人设：\n${role.prompt.persona.trim()}`
      : null,
    role.prompt.scenario.trim()
      ? `场景：\n${role.prompt.scenario.trim()}`
      : null,
    role.prompt.exampleDialogues.trim()
      ? `示例对话：\n${role.prompt.exampleDialogues.trim()}`
      : null,
    role.prompt.style.trim()
      ? `表达风格：\n${role.prompt.style.trim()}`
      : null,
    role.prompt.constraints.trim()
      ? `约束：\n${role.prompt.constraints.trim()}`
      : null,
  ].filter((value): value is string => Boolean(value));

  if (sections.length === 0) {
    return null;
  }

  return [
    "以下是当前线程绑定的角色设定。你必须稳定遵守该角色的人设、表达风格与约束，但不要直接提到“根据角色设定”或“根据系统提示”。",
    `角色名：${role.name}`,
    ...sections,
  ].join("\n\n");
};

/**
 * Role resolver:
 * Expands a persisted `roleId` into one canonical system prompt.
 */
export const resolveRoleContext: RequestContextResolver = ({ thread, userId }) => {
  if (!thread.roleId) {
    return null;
  }

  const content = buildRolePromptContent(thread.roleId, userId);
  if (!content) {
    return null;
  }

  return {
    message: {
      role: "system",
      content,
    },
    executionNode: {
      nodeId: `request-context-role-${thread.roleId}`,
      nodeType: "memory",
      phase: "done",
      label: "角色记忆",
      summary: "已加载线程绑定角色设定",
      details: {
        roleId: thread.roleId,
      },
    },
  };
};
