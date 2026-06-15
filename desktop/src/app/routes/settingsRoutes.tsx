import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Blend,
  Bolt,
  FlaskConical,
  Info,
  LibraryBig,
  ListChecks,
  Wrench,
} from "lucide-react";
import About from "@/features/Settings/pages/About/index";
import GeneralSettings from "@/features/Settings/pages/General/index";
import AccountSettings from "@/features/Settings/pages/Account/index";
import KnowledgeBaseSettings from "@/features/Settings/pages/KnowledgeBase/index";
import KnowledgeBaseAddWizard from "@/features/Settings/pages/KnowledgeBase/Add";
import KnowledgeBaseDetail from "@/features/Settings/pages/KnowledgeBase/Detail";
import ModelSettings from "@/features/Settings/pages/ModelSetting";
import EvaluationWorkbench from "@/features/Settings/pages/Evaluation/Workbench";
import EvaluationCenter from "@/features/Settings/pages/Evaluation/Center";
import ToolsSettings from "@/features/Settings/pages/Tools/index";

type SettingsRouteNavMeta = {
  label: string;
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
    nav: { label: "通用", icon: Bolt },
  },
  {
    path: "model-setting",
    element: <ModelSettings />,
    nav: { label: "模型", icon: Blend },
  },
  {
    path: "knowledge-base",
    element: <KnowledgeBaseSettings />,
    nav: { label: "知识库", icon: LibraryBig },
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
        path: "workbench",
        element: <EvaluationWorkbench />,
        nav: { label: "评测工作台", icon: FlaskConical },
      },
      {
        path: "center",
        element: <EvaluationCenter />,
        nav: { label: "评测中心", icon: ListChecks },
      },
    ],
  },
  {
    path: "tools",
    element: <ToolsSettings />,
    nav: { label: "工具", icon: Wrench },
  },
  {
    path: "about",
    element: <About />,
    nav: { label: "关于", icon: Info },
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
  parentPath = "/settings",
): SettingsNavigationItem[] {
  return routes.flatMap((route) => {
    const currentPath = `${parentPath}/${route.path}`;
    const ownItem = route.nav
      ? [
          {
            label: route.nav.label,
            icon: route.nav.icon,
            to: currentPath,
          },
        ]
      : [];

    const childItems = route.children
      ? buildSettingsNavigationItems(route.children, currentPath)
      : [];

    return [...ownItem, ...childItems];
  });
}

export const settingsRoutes = buildSettingsRouteObjects(settingsRouteTree);

// 设置侧边导航和实际路由共用同一份配置，后续扩展成多级菜单时不需要再维护第二套映射。
export const settingsNavigationItems =
  buildSettingsNavigationItems(settingsRouteTree);
