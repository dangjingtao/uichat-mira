import type {
  ProviderDetail,
  ProviderSummary,
  RoleModelType,
} from "@/shared/api/modelSettings";

type RoleGroup = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  roles: Array<{
    role: RoleModelType;
    readOnly?: boolean;
    actionLabelKey: string;
  }>;
};

type CapabilityGroup = {
  id: string;
  labelKey: string;
  roles: RoleModelType[];
};

export const MODEL_ROLE_GROUPS: RoleGroup[] = [
  {
    id: "chat",
    titleKey: "settings.model.groups.chat.title",
    descriptionKey: "settings.model.groups.chat.description",
    roles: [{ role: "llm", actionLabelKey: "settings.model.api.setDefaultLlm" }],
  },
  {
    id: "agent-task",
    titleKey: "settings.model.groups.agentTask.title",
    descriptionKey: "settings.model.groups.agentTask.description",
    roles: [
      {
        role: "task",
        readOnly: true,
        actionLabelKey: "settings.model.api.setDefaultTask",
      },
      {
        role: "agentTask",
        readOnly: true,
        actionLabelKey: "settings.model.api.setDefaultAgentTask",
      },
    ],
  },
  {
    id: "knowledge-base",
    titleKey: "settings.model.groups.knowledgeBase.title",
    descriptionKey: "settings.model.groups.knowledgeBase.description",
    roles: [
      {
        role: "embedding",
        actionLabelKey: "settings.model.api.setDefaultEmbedding",
      },
      {
        role: "rerank",
        actionLabelKey: "settings.model.api.setDefaultRerank",
      },
    ],
  },
  {
    id: "evaluation",
    titleKey: "settings.model.groups.evaluation.title",
    descriptionKey: "settings.model.groups.evaluation.description",
    roles: [
      {
        role: "evaluation",
        actionLabelKey: "settings.model.api.setDefaultEvaluation",
      },
    ],
  },
  {
    id: "image-generation",
    titleKey: "settings.model.groups.imageGeneration.title",
    descriptionKey: "settings.model.groups.imageGeneration.description",
    roles: [
      {
        role: "imageGeneration",
        readOnly: true,
        actionLabelKey: "settings.model.api.setDefaultImageGeneration",
      },
    ],
  },
];

export const PROVIDER_CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: "chat",
    labelKey: "settings.model.capabilities.chat",
    roles: ["llm", "task", "agentTask", "evaluation"],
  },
  {
    id: "embedding",
    labelKey: "settings.model.capabilities.embedding",
    roles: ["embedding"],
  },
  {
    id: "rerank",
    labelKey: "settings.model.capabilities.rerank",
    roles: ["rerank"],
  },
  {
    id: "image",
    labelKey: "settings.model.capabilities.image",
    roles: ["imageGeneration"],
  },
];

export function providerSupportsCapability(
  provider: Pick<ProviderSummary, "capabilities"> | Pick<ProviderDetail["provider"], "capabilities">,
  capabilityId: CapabilityGroup["id"],
) {
  const capability = PROVIDER_CAPABILITY_GROUPS.find((item) => item.id === capabilityId);
  if (!capability) {
    return false;
  }

  return capability.roles.some((role) =>
    provider.capabilities.supportsRoles.includes(role),
  );
}
