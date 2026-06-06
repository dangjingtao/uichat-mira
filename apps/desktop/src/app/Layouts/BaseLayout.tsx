import { Outlet, Link } from "react-router-dom";
import React, { FunctionComponent, ReactNode } from "react";
import Sidebar from "./Sidebar";
import NavItem from "@/shared/ui/NavItem";
import {
  CircleUser,
  Bolt,
  Info,
  LibraryBig,
  Blend,
  ArrowLeft,
} from "lucide-react";

interface BaseLayoutProps {
  children?: ReactNode;
  mode: "chat" | "settings";
}

const settingNavItems = [
  { label: "通用", path: "/settings/general", icon: <Bolt size={16} /> },
  {
    label: "账号",
    path: "/settings/account",
    icon: <CircleUser size={16} />,
  },
  { label: "模型", path: "/settings/model-setting", icon: <Blend size={16} /> },
  {
    label: "知识库",
    path: "/settings/knowledge-base",
    icon: <LibraryBig size={16} />,
  },
  { label: "关于", path: "/settings/about", icon: <Info size={16} /> },
];

const BaseLayout: FunctionComponent<BaseLayoutProps> = ({ mode }) => {
  const contents =
    mode === "chat"
      ? []
      : settingNavItems.map((item) => {
          return (
            <NavItem key={item.path} to={item.path} icon={item.icon}>
              {item.label}
            </NavItem>
          );
        });
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        height: "100dvh",
      }}
    >
      {/* 侧边栏 */}
      <Sidebar>
        {mode !== "chat" && (
          <NavItem to="/chat" icon={<ArrowLeft size={16} />}>
            返回聊天
          </NavItem>
        )}

        <>{contents}</>
      </Sidebar>

      {/* 主区域：子路由渲染到这里 */}
      <main className="mx-auto flex h-screen w-full flex-col px-0 border border-slate-200 overflow-y-auto bg-white">
        <section className="flex min-h-0 flex-1 rounded-xl  shadow-sm ">
          <Outlet />
        </section>
      </main>
    </div>
  );
};

export default BaseLayout;
