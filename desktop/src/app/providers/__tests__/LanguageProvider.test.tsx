// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LanguageProvider,
  useLanguagePreferences,
} from "../LanguageProvider";

const languageState = vi.hoisted(() => ({
  language: "en" as string,
  resolvedLanguage: "en" as string | undefined,
  changeLanguage: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: languageState }),
}));

function Probe() {
  const language = useLanguagePreferences();
  return (
    <div>
      <span data-testid="language">{language.language}</span>
      <span data-testid="supported">{language.supportedLanguages.join(",")}</span>
      <button onClick={() => void language.setLanguage("zh-CN")}>Chinese</button>
    </div>
  );
}

describe("LanguageProvider", () => {
  beforeEach(() => {
    languageState.language = "en";
    languageState.resolvedLanguage = "en";
    languageState.changeLanguage.mockReset();
    languageState.changeLanguage.mockResolvedValue(undefined);
  });

  it("normalizes the active language and exposes supported languages", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    expect(screen.getByTestId("language")).toHaveTextContent("en-US");
    expect(screen.getByTestId("supported")).toHaveTextContent("zh-CN,en-US");
    await user.click(screen.getByRole("button", { name: "Chinese" }));
    expect(languageState.changeLanguage).toHaveBeenCalledWith("zh-CN");
  });

  it("falls back to Chinese for unsupported language codes", () => {
    languageState.language = "fr-FR";
    languageState.resolvedLanguage = undefined;
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("language")).toHaveTextContent("zh-CN");
  });

  it("requires consumers to be inside the provider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      "useLanguagePreferences must be used within a LanguageProvider",
    );
    errorSpy.mockRestore();
  });
});
