import React from "react";
import { useTranslation } from "react-i18next";
import { copyTextToClipboard } from "@/shared/lib/clipboard";
import {
  getDesktopRuntime,
  openExternalUrl,
  type DesktopHostKind,
} from "@/shared/platform/desktopRuntime";
import { message } from "./Message";
import { Modal } from "./Modal";
import type { ConfirmTone } from "./ConfirmDialog";

export interface ExternalLinkConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
  loadingText?: string;
}

export interface ExternalLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  copyOnlyHosts?: DesktopHostKind[];
  confirmBeforeOpen?: boolean | ExternalLinkConfirmOptions;
}

export default function ExternalLink({
  href,
  copyOnlyHosts = [],
  confirmBeforeOpen = false,
  children,
  onClick,
  rel,
  target,
  ...anchorProps
}: ExternalLinkProps) {
  const { t } = useTranslation();

  const handleCopyFallback = async (url: string, copyOnly: boolean) => {
    const copied = await copyTextToClipboard(url);

    if (copied) {
      message.info(
        copyOnly
          ? t("ui.externalLink.copyOnlySuccess")
          : t("ui.externalLink.openFailedCopied"),
      );
      return;
    }

    message.error(t("ui.externalLink.copyFailed"));
  };

  const openLink = async () => {
    const url = href.trim();
    if (!url) {
      return;
    }

    const runtime = getDesktopRuntime();
    const copyOnly = copyOnlyHosts.includes(runtime.hostKind);

    if (copyOnly) {
      await handleCopyFallback(url, true);
      return;
    }

    try {
      await openExternalUrl(url);
    } catch {
      await handleCopyFallback(url, false);
    }
  };

  const handleClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) {
      return;
    }

    event.preventDefault();

    if (!confirmBeforeOpen) {
      await openLink();
      return;
    }

    const confirmOptions =
      typeof confirmBeforeOpen === "object" ? confirmBeforeOpen : undefined;

    Modal.confirm({
      title:
        confirmOptions?.title ?? t("ui.externalLink.confirm.title"),
      description:
        confirmOptions?.description ??
        t("ui.externalLink.confirm.description", { url: href.trim() }),
      confirmText:
        confirmOptions?.confirmText ?? t("ui.externalLink.confirm.confirmText"),
      cancelText:
        confirmOptions?.cancelText ?? t("ui.externalLink.confirm.cancelText"),
      tone: confirmOptions?.tone ?? "warning",
      loadingText:
        confirmOptions?.loadingText ?? t("ui.externalLink.confirm.loadingText"),
      onConfirm: openLink,
    });
  };

  return (
    <a
      href={href}
      target={target ?? "_blank"}
      rel={rel ?? "noreferrer noopener"}
      onClick={(event) => {
        void handleClick(event);
      }}
      {...anchorProps}
    >
      {children}
    </a>
  );
}
