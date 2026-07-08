// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import NewsHubPage from "../index";

const apiMocks = vi.hoisted(() => ({
  getNewsHubOverview: vi.fn(),
  getNewsHubConfig: vi.fn(),
  refreshNewsHub: vi.fn(),
  saveNewsHubConfig: vi.fn(),
}));

const messageMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

vi.mock("@/shared/api/newsHub", () => ({
  getNewsHubOverview: apiMocks.getNewsHubOverview,
  getNewsHubConfig: apiMocks.getNewsHubConfig,
  refreshNewsHub: apiMocks.refreshNewsHub,
  saveNewsHubConfig: apiMocks.saveNewsHubConfig,
}));

vi.mock("@/shared/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/ui")>();

  return {
    ...actual,
    Button: ({
      children,
      onClick,
      disabled,
      type,
      className,
    }: {
      children: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
      type?: "button" | "submit" | "reset";
      className?: string;
    }) => (
      <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={className}>
        {children}
      </button>
    ),
    ExternalLink: ({
      children,
      href,
    }: {
      children: ReactNode;
      href: string;
    }) => <a href={href}>{children}</a>,
    FullPageStatus: ({ message }: { message: string }) => <div>{message}</div>,
    Modal: ({
      open,
      title,
      children,
      footer,
    }: {
      open: boolean;
      title: string;
      children: ReactNode;
      footer?: ReactNode;
    }) =>
      open ? (
        <div>
          <div>{title}</div>
          <div>{children}</div>
          <div>{footer}</div>
        </div>
      ) : null,
    NumberInput: ({
      label,
      value,
      onChange,
    }: {
      label: string;
      value: number;
      onChange: (value: number) => void;
    }) => (
      <label>
        <span>{label}</span>
        <input
          aria-label={label}
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </label>
    ),
    Select: ({
      value,
      onChange,
      options,
    }: {
      value?: string;
      onChange?: (value: string) => void;
      options?: Array<{ value: string; label: string }>;
    }) => (
      <select
        aria-label="source-select"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
    Switch: ({
      checked,
      onChange,
      ariaLabel,
    }: {
      checked: boolean;
      onChange?: () => void;
      ariaLabel?: string;
    }) => (
      <input
        aria-label={ariaLabel}
        type="checkbox"
        checked={checked}
        onChange={() => onChange?.()}
      />
    ),
    TextInput: ({
      label,
      value,
      onChange,
      type,
    }: {
      label?: string;
      value: string;
      onChange: (value: string) => void;
      type?: string;
    }) => (
      <label>
        <span>{label}</span>
        <input
          aria-label={label}
          type={type ?? "text"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    ),
    message: messageMocks,
  };
});

describe("NewsHubPage", () => {
  beforeEach(() => {
    apiMocks.getNewsHubOverview.mockResolvedValue({
      sources: [],
      items: [],
      total: 0,
      generatedAt: "2026-07-08T10:00:00.000Z",
    });
    apiMocks.getNewsHubConfig.mockResolvedValue({
      newsDataEnabled: true,
      newsDataApiKey: "persisted-newsdata-key",
      currentsEnabled: false,
      currentsApiKey: "",
      redditEnabled: true,
      redditClientId: "persisted-reddit-client-id",
      redditClientSecret: "persisted-reddit-client-secret",
      redditUserAgent: "UIChat-Mira-NewsHub/0.4",
      redditSubreddits: "technology+ai",
      refreshTtlMinutes: 180,
    });
    apiMocks.refreshNewsHub.mockResolvedValue({
      startedAt: "2026-07-08T10:00:00.000Z",
      finishedAt: "2026-07-08T10:00:01.000Z",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      ttlMinutes: 180,
      sources: [],
    });
    apiMocks.saveNewsHubConfig.mockImplementation(async (payload) => payload);
    messageMocks.success.mockReset();
    messageMocks.error.mockReset();
  });

  it("loads persisted config and saves updated ttl through the config modal", async () => {
    render(<NewsHubPage />);

    expect(screen.getByTestId("news-hub-loading-skeleton")).toBeInTheDocument();
    expect(
      screen.queryByText("settings.microApps.newsHub.states.loading"),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(apiMocks.getNewsHubConfig).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /settings\.microApps\.newsHub\.actions\.configureSources/,
      }),
    );

    const ttlInput = screen.getByLabelText(
      "settings.microApps.newsHub.config.refreshTtlMinutes",
    ) as HTMLInputElement;
    expect(ttlInput.value).toBe("180");

    fireEvent.change(ttlInput, { target: { value: "240" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: /settings\.microApps\.newsHub\.actions\.saveConfig/,
      }),
    );

    await waitFor(() => {
      expect(apiMocks.saveNewsHubConfig).toHaveBeenCalledWith({
        newsDataEnabled: true,
        newsDataApiKey: "persisted-newsdata-key",
        currentsEnabled: false,
        currentsApiKey: "",
        redditEnabled: true,
        redditClientId: "persisted-reddit-client-id",
        redditClientSecret: "persisted-reddit-client-secret",
        redditUserAgent: "UIChat-Mira-NewsHub/0.4",
        redditSubreddits: "technology+ai",
        refreshTtlMinutes: 240,
      });
    });
  });
});
