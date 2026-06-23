import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import {
  Blend,
  Bolt,
  Info,
  LibraryBig,
  ListChecks,
  Wrench,
  UserRoundPen,
} from "lucide-react";
import About from "@/features/Settings/pages/About/index";
import GeneralSettings from "@/features/Settings/pages/General/index";
import AccountSettings from "@/features/Settings/pages/Account/index";
import KnowledgeBaseSettings from "@/features/Settings/pages/KnowledgeBase/index";
import KnowledgeBaseAddWizard from "@/features/Settings/pages/KnowledgeBase/Add";
import KnowledgeBaseDetail from "@/features/Settings/pages/KnowledgeBase/Detail";
import ModelSettings from "@/features/Settings/pages/ModelSetting";
import EvaluationNew from "@/features/Settings/pages/Evaluation/New";
import EvaluationCenter from "@/features/Settings/pages/Evaluation/Center";
import ToolsSettings from "@/features/Settings/pages/Tools/index";
import RoleSettings from "@/features/Settings/pages/Personas/index";

type SettingsRouteNavMeta = {
  labelKey: string;
  icon: LucideIcon;
};

type SettingsRouteConfig = {
  path: string;
  element?: ReactNode;
  children?: SettingsRouteConfig[];
  nav?: SettingsRouteNavMeta;
};

export type SettingsNavigationItem = {
  label: string;
  icon: LucideIcon;
  to: string;
};

const settingsRouteTree: SettingsRouteConfig[] = [
  {
    path: "general",
    element: <GeneralSettings />,
    nav: { labelKey: "settings.navigation.general", icon: Bolt },
  },
  {
    path: "model-setting",
    element: <ModelSettings />,
    nav: { labelKey: "settings.navigation.model", icon: Blend },
  },
  {
    path: "knowledge-base",
    element: <KnowledgeBaseSettings />,
    nav: { labelKey: "settings.navigation.knowledgeBase", icon: LibraryBig },
  },
  {
    path: "roles",
    element: <RoleSettings />,
    nav: { labelKey: "settings.navigation.roles", icon: UserRoundPen },
  },
  {
    path: "knowledge-base/add",
    element: <KnowledgeBaseAddWizard />,
  },
  {
    path: "knowledge-base/detail",
    element: <KnowledgeBaseDetail />,
  },
  {
    path: "evaluation",
    children: [
      {
        path: "center",
        element: <EvaluationCenter />,
        nav: {
          labelKey: "settings.navigation.evaluationCenter",
          icon: ListChecks,
        },
      },
      {
        path: "center/new",
        element: <EvaluationNew />,
      },
    ],
  },
  {
    path: "tools",
    element: <ToolsSettings />,
    nav: { labelKey: "settings.navigation.tools", icon: Wrench },
  },
  {
    path: "about",
    element: <About />,
    nav: { labelKey: "settings.navigation.about", icon: Info },
  },
  {
    path: "account",
    element: <AccountSettings />,
  },
];

function buildSettingsRouteObjects(routes: SettingsRouteConfig[]): RouteObject[] {
  return routes.map((route) => ({
    path: route.path,
    element: route.element,
    children: route.children
      ? buildSettingsRouteObjects(route.children)
      : undefined,
  }));
}

function buildSettingsNavigationItems(
  routes: SettingsRouteConfig[],
  translate: (key: string) => string,
  parentPath = "/settings",
): SettingsNavigationItem[] {
  return routes.flatMap((route) => {
    const currentPath = `${parentPath}/${route.path}`;
    const ownItem = route.nav
      ? [
          {
            label: translate(route.nav.labelKey),
            icon: route.nav.icon,
            to: currentPath,
          },
        ]
      : [];

    const childItems = route.children
      ? buildSettingsNavigationItems(route.children, translate, currentPath)
      : [];

    return [...ownItem, ...childItems];
  });
}

export const settingsRoutes = buildSettingsRouteObjects(settingsRouteTree);

// 设置侧边导航和实际路由共用同一份配置，后续扩展成多级菜单时不需要再维护第二套映射。
export const useSettingsNavigationItems = () => {
  const { t } = useTranslation();

  return useMemo(
    () => buildSettingsNavigationItems(settingsRouteTree, t),
    [t],
  );
};
