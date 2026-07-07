// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import type { RoleModelConfig } from "@/shared/api/modelSettings";

const modalMocks = vi.hoisted(() => ({
  showMock: vi.fn(() => "modal-1"),
  closeMock: vi.fn(),
}));

vi.mock("@/shared/ui/Modal", () => ({
  Modal: {
    show: modalMocks.showMock,
    close: modalMocks.closeMock,
  },
}));

vi.mock("@/shared/business/localModels", () => ({
  getBuiltInLocalModel: () => null,
}));

vi.mock("@/shared/business/modelAccess", () => ({
  hasConfiguredProviderBinding: (config: RoleModelConfig | null) =>
    Boolean(config?.remoteModelId),
}));

const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "settings.model.config.llm.title": "LLM",
        "settings.model.config.llm.subtitle": "LLM subtitle",
        "settings.model.config.configured": "Configured",
        "settings.model.config.notConfigured": "Not configured",
        "settings.model.config.selectModel": "Select model",
        "settings.model.config.connectionLabel": "Connection: {{provider}}",
        "settings.model.config.chooseModel": "Choose Model",
        "settings.model.config.openEditor": "Edit Params",
        "settings.model.config.viewDetails": "View Details",
        "settings.model.config.editInDialogHint": "Edit in dialog",
        "settings.model.config.viewInDialogHint": "View in dialog",
      },
    },
  },
});

import ModelConfig from "./ModelConfig";

describe("ModelConfig", () => {
  it("renders summary card and opens dialog entry instead of inline params", async () => {
    const user = userEvent.setup();
    const config: RoleModelConfig = {
      id: "llm-1",
      type: "llm",
      name: "gpt-4.1",
      providerCode: "openai",
      providerConnectionId: "conn-openai",
      providerConnectionDisplayName: "OpenAI Main",
      providerTemplateCode: "openai",
      remoteModelId: "gpt-4.1",
      params: { temperature: 0.7, maxTokens: 4096 },
      isDefault: true,
      createdAt: "2026-07-06T10:00:00.000Z",
      updatedAt: "2026-07-06T10:00:00.000Z",
    };

    render(
      <I18nextProvider i18n={i18n}>
        <ModelConfig modelType="llm" config={config} onUpdated={() => {}} />
      </I18nextProvider>,
    );

    expect(screen.getByText("LLM")).toBeInTheDocument();
    expect(screen.getByText("LLM subtitle")).toBeInTheDocument();
    expect(screen.getByText("gpt-4.1")).toBeInTheDocument();
    expect(screen.queryByText("Temperature")).not.toBeInTheDocument();
    expect(screen.queryByText("Configured")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose Model" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Params" }));

    expect(modalMocks.showMock).toHaveBeenCalledTimes(1);
  });
});
