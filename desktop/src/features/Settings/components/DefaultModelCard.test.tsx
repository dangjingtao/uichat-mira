// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import type { RoleModelConfig } from "@/shared/api/modelSettings";

const mockedConfigProvider = vi.hoisted(() => {
  const createConfig = (type: RoleModelConfig["type"]): RoleModelConfig => ({
    id: `${type}-1`,
    type,
    name: `${type}-model`,
    providerCode: null,
    providerConnectionId: null,
    providerTemplateCode: null,
    remoteModelId: null,
    params: {},
    isDefault: true,
    createdAt: "2026-07-06T10:00:00.000Z",
    updatedAt: "2026-07-06T10:00:00.000Z",
  });

  return {
    refresh: vi.fn(async () => []),
    configMap: {
      llm: createConfig("llm"),
      embedding: createConfig("embedding"),
      rerank: createConfig("rerank"),
      task: createConfig("task"),
      agentTask: createConfig("agentTask"),
      evaluation: createConfig("evaluation"),
      imageGeneration: createConfig("imageGeneration"),
    },
  };
});

const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "settings.model.config.llm.title": "LLM",
        "settings.model.config.llm.subtitle": "LLM subtitle",
        "settings.model.config.task.title": "Task Model Configuration",
        "settings.model.config.task.subtitle": "Task subtitle",
        "settings.model.config.task.readOnlyHint": "Task read only",
        "settings.model.config.agentTask.title": "AgentTask Model",
        "settings.model.config.agentTask.subtitle": "AgentTask subtitle",
        "settings.model.config.agentTask.readOnlyHint":
          "AgentTask read only",
        "settings.model.config.evaluation.title": "Evaluation Model",
        "settings.model.config.evaluation.subtitle": "Evaluation subtitle",
        "settings.model.config.embedding.title": "Embedding",
        "settings.model.config.embedding.subtitle": "Embedding subtitle",
        "settings.model.config.rerank.title": "ReRank",
        "settings.model.config.rerank.subtitle": "ReRank subtitle",
        "settings.model.config.imageGeneration.title":
          "Image Generation Model",
        "settings.model.config.imageGeneration.subtitle":
          "Image generation subtitle",
        "settings.model.config.imageGeneration.readOnlyHint":
          "Image generation read only",
        "settings.model.config.notConfigured": "Not configured",
        "settings.model.config.selectModel": "Select model",
        "settings.model.config.managed": "Managed",
        "settings.model.defaultCard.syncing": "Syncing...",
        "settings.model.groups.chat.title": "Chat",
        "settings.model.groups.chat.description": "Chat group",
        "settings.model.groups.agentTask.title": "Agent / Task",
        "settings.model.groups.agentTask.description": "Agent group",
        "settings.model.groups.knowledgeBase.title": "Knowledge Base",
        "settings.model.groups.knowledgeBase.description": "KB group",
        "settings.model.groups.evaluation.title": "Evaluation",
        "settings.model.groups.evaluation.description": "Evaluation group",
        "settings.model.groups.imageGeneration.title": "Image Generation",
        "settings.model.groups.imageGeneration.description": "Image group",
      },
    },
  },
});

vi.mock("@/app/providers/RoleModelConfigProvider", () => ({
  useRoleModelConfigs: () => ({
    configMap: mockedConfigProvider.configMap,
    loading: false,
    refresh: mockedConfigProvider.refresh,
  }),
}));

import DefaultModelCard from "./DefaultModelCard";

describe("DefaultModelCard", () => {
  it("renders grouped role sections and new role cards", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <DefaultModelCard />
      </I18nextProvider>,
    );

    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Knowledge Base")).toBeInTheDocument();
    expect(screen.getByText("AgentTask Model")).toBeInTheDocument();
    expect(screen.getByText("Image Generation Model")).toBeInTheDocument();
  });
});
