// @vitest-environment jsdom
import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModelSettings from "../index";

const {
  confirmMock,
  messageSuccess,
  messageError,
  resetProviderRoleModelMock,
} = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  resetProviderRoleModelMock: vi.fn(async () => undefined),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/shared/ui/Message", () => ({
  message: {
    success: messageSuccess,
    error: messageError,
  },
}));

vi.mock("@/shared/ui/Modal", () => ({
  Modal: {
    confirm: confirmMock,
    show: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock("@/shared/api/modelSettings", () => ({
  resetProviderRoleModel: resetProviderRoleModelMock,
}));

vi.mock("@/app/providers/RoleModelConfigProvider", () => ({
  useRoleModelConfigs: () => ({
    refresh: vi.fn(async () => undefined),
  }),
}));

vi.mock("@/features/Settings/components/DefaultModelCard", () => ({
  default: Object.assign(
    React.forwardRef<
      { openPlatformSettings: () => void },
      { onReady?: () => void }
    >(({ onReady }, ref) => {
      React.useImperativeHandle(ref, () => ({
        openPlatformSettings: vi.fn(),
      }));
      React.useEffect(() => {
        onReady?.();
      }, [onReady]);
      return <div data-testid="default-model-card">DefaultModelCard</div>;
    }),
    { displayName: "DefaultModelCard" },
  ),
}));

describe("ModelSettings", () => {
  it("renders page title and action buttons", () => {
    render(<ModelSettings />);

    expect(screen.getByText("settings.model.page.title")).toBeInTheDocument();
    expect(
      screen.getByText("settings.model.actions.resetDefault"),
    ).toBeInTheDocument();
  });

  it("opens reset confirmation modal when reset button is clicked", () => {
    render(<ModelSettings />);

    screen.getByText("settings.model.actions.resetDefault").click();

    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "settings.model.resetModal.title",
        tone: "danger",
      }),
    );
  });

  it("resets all providers and refreshes when confirmed", async () => {
    render(<ModelSettings />);

    screen.getByText("settings.model.actions.resetDefault").click();

    const { onConfirm } = confirmMock.mock.calls[0]![0] as {
      onConfirm: () => Promise<void>;
    };
    await onConfirm();

    expect(resetProviderRoleModelMock).toHaveBeenCalledTimes(6);
    expect(resetProviderRoleModelMock).toHaveBeenCalledWith("llm");
    expect(resetProviderRoleModelMock).toHaveBeenCalledWith("embedding");
    expect(resetProviderRoleModelMock).toHaveBeenCalledWith("rerank");
    expect(resetProviderRoleModelMock).toHaveBeenCalledWith("task");
    expect(resetProviderRoleModelMock).toHaveBeenCalledWith("agentTask");
    expect(resetProviderRoleModelMock).toHaveBeenCalledWith("evaluation");
    await waitFor(() => {
      expect(messageSuccess).toHaveBeenCalledWith(
        "settings.model.resetModal.success",
      );
    });
  });

  it("shows error message when reset fails", async () => {
    resetProviderRoleModelMock.mockRejectedValueOnce(new Error("reset failed"));

    render(<ModelSettings />);

    screen.getByText("settings.model.actions.resetDefault").click();

    const { onConfirm } = confirmMock.mock.calls[0]![0] as {
      onConfirm: () => Promise<void>;
    };
    await onConfirm();

    await waitFor(() => {
      expect(messageError).toHaveBeenCalledWith("reset failed");
    });
  });
});
