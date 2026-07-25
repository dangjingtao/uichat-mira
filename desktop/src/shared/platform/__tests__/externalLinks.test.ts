// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { installDesktopExternalLinkHandler } from "../externalLinks";

const resetRuntime = () => {
  delete (window as unknown as Record<string, unknown>).desktopRuntime;
  delete (window as unknown as Record<string, unknown>).electronAPI;
  delete (window as unknown as Record<string, unknown>).__TAURI__;
  document.body.innerHTML = "";
};

afterEach(() => {
  resetRuntime();
  vi.restoreAllMocks();
});

describe("installDesktopExternalLinkHandler", () => {
  it("Electron 中将 target=_blank 链接交给系统浏览器", async () => {
    const invoke = vi.fn().mockResolvedValue(true);
    Object.assign(window, {
      desktopRuntime: {
        hostKind: "electron",
        platform: "win32",
        isPackaged: false,
        backendUrl: "http://127.0.0.1:8788",
      },
      electronAPI: { invoke },
    });

    document.body.innerHTML = `
      <a href="https://github.com/login/device" target="_blank">
        <span id="open-github">打开授权页</span>
      </a>
    `;

    const uninstall = installDesktopExternalLinkHandler();
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    document.getElementById("open-github")?.dispatchEvent(event);
    await Promise.resolve();

    expect(event.defaultPrevented).toBe(true);
    expect(invoke).toHaveBeenCalledWith(
      "desktop:open-external",
      "https://github.com/login/device",
    );

    uninstall();
  });

  it("Tauri 中通过 shell plugin 打开同一个系统浏览器", async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    Object.assign(window, {
      desktopRuntime: {
        hostKind: "tauri",
        platform: "win32",
        isPackaged: false,
        backendUrl: "http://127.0.0.1:8788",
      },
      __TAURI__: { shell: { open } },
    });

    document.body.innerHTML = `
      <a id="github-app" href="https://github.com/apps/uichat-mira/installations/new" target="_blank">
        添加仓库授权
      </a>
    `;

    const uninstall = installDesktopExternalLinkHandler();
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    document.getElementById("github-app")?.dispatchEvent(event);
    await Promise.resolve();

    expect(event.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith(
      "https://github.com/apps/uichat-mira/installations/new",
    );

    uninstall();
  });

  it("浏览器预览模式保留原生链接行为", () => {
    document.body.innerHTML = `
      <a id="docs-link" href="https://example.com" target="_blank">Docs</a>
    `;

    installDesktopExternalLinkHandler();
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    document.getElementById("docs-link")?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
