"use client";

import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import Sidebar from "../Sidebar";
import NavItem from "@/shared/ui/NavItem";
import Divider from "@/shared/ui/Divider";
import { useSettingsNavigationItems } from "@/app/routes/settingsRoutes";

/**
 * Shared shell for workspace-style pages.
 *
 * Risk note:
 * This shell is intentionally presentation-only. Runtime ownership stays in the
 * chat/settings workspace files so future route changes do not accidentally
 * couple visual layout changes with the chat runtime lifecycle.
 */
export function WorkspaceShell({
  sidebarContent,
  showBackToChatLink,
  mainContent,
  shellClassName,
  contentClassName,
}: {
  sidebarContent: ReactNode;
  showBackToChatLink: boolean;
  mainContent: ReactNode;
  shellClassName?: string;
  contentClassName?: string;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="w-full min-w-0"
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        height: "100dvh",
      }}
    >
      <Sidebar>
        {showBackToChatLink ? (
          <NavItem to="/chat" icon={<ArrowLeft size={16} />}>
            {t("common.actions.backToChat")}
          </NavItem>
        ) : null}
        {sidebarContent}
      </Sidebar>

      <main
        className={`flex h-screen w-full min-w-0 flex-col overflow-hidden px-0 ${
          shellClassName ?? "rounded-l-[24px] bg-surface-primary"
        }`}
      >
        <section className="flex min-h-0 flex-1">
          <div
            className={`flex min-h-0 min-w-0 flex-1 ${contentClassName ?? ""}`}
          >
            {mainContent}
          </div>
        </section>
      </main>
    </div>
  );
}

export function SettingsNavigation() {
  const { t } = useTranslation();
  const settingsNavigationItems = useSettingsNavigationItems();

  const primaryItems = settingsNavigationItems.filter(
    (item) =>
      item.to === "/settings/general" || item.to === "/settings/model-setting",
  );

  const knowledgeBaseItems = settingsNavigationItems.filter(
    (item) => item.to === "/settings/knowledge-base",
  );

  const evaluationItems = settingsNavigationItems.filter(
    (item) =>
      item.to === "/settings/evaluation/center/new" ||
      item.to === "/settings/evaluation/center",
  );

  const utilityItems = settingsNavigationItems.filter(
    (item) => item.to === "/settings/tools" || item.to === "/settings/about",
  );

  const knowledgeWorkspaceItems = [...knowledgeBaseItems, ...evaluationItems];
  const roleItems = settingsNavigationItems.filter(
    (item) => item.to === "/settings/roles",
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <NavLink
        to="/chat"
        className="mb-3 inline-flex items-center gap-2 rounded-[10px] px-2 py-2 text-sm text-text-secondary transition-colors duration-150 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <ArrowLeft size={15} />
        {t("common.actions.backToChat")}
      </NavLink>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <SettingsNavigationGroup items={primaryItems} />
        <Divider />
        <SettingsNavigationGroup
          title={t("settings.navigation.workspace")}
          items={knowledgeWorkspaceItems}
        />
        {roleItems.length > 0 ? (
          <>
            <Divider />
            <SettingsNavigationGroup
              title={t("settings.navigation.roles")}
              items={roleItems}
            />
          </>
        ) : null}
        <Divider />
        <SettingsNavigationGroup items={utilityItems} />
      </div>
    </div>
  );
}

function SettingsNavigationGroup({
  title,
  items,
}: {
  title?: string;
  items: ReturnType<typeof useSettingsNavigationItems>;
}) {
  return (
    <div className="space-y-1">
      {title ? (
        <div className="px-2 pb-1 text-[12px] font-medium text-text-tertiary">
          {title}
        </div>
      ) : null}
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-[10px] px-3 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated ${
                isActive
                  ? "bg-primary/10 text-text-primary"
                  : "text-text-secondary hover:bg-surface-secondary/70 hover:text-text-primary"
              }`
            }
          >
            <Icon size={16} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}
