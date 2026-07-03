# 前端国际化约定

Status: Current
Owner: frontend
Last verified: 2026-06-25
Layer: raw-source
Module: Develoments
Feature: FrontendI18n
Doc Type: current-contract
Canonical: true
Related:
  - README.md
  - ../architecture/README.md

## 单点真相范围

这页文档统一说明前端国际化文案的归属、注册和使用方式。

相关文档：

- [[README]]
- [[architecture/README]]

## 当前模型

前端使用 `i18next` 与 `react-i18next`：

- 初始化入口：`desktop/src/shared/i18n/index.ts`
- 基础共享资源：`desktop/src/shared/i18n/zh-CN.ts`、`desktop/src/shared/i18n/en-US.ts`
- app 壳层文案：`desktop/src/app/i18n/`
- shared UI 组件文案：`desktop/src/shared/ui/i18n/`
- feature 或页面文案：对应 `features/**/i18n/` 或页面目录内的 `i18n/`

当前支持语言：

- `zh-CN`
- `en-US`

默认 fallback 为 `zh-CN`。

## 文案归属规则

页面级 i18n 全部由页面或所属 feature 内部维护。

不要把页面专属文案继续塞进 `desktop/src/shared/i18n/zh-CN.ts` 或 `desktop/src/shared/i18n/en-US.ts`。这两个文件只保留真正跨页面、跨 feature 复用的基础文案，例如通用动作、通用状态、无法归属到具体业务页面的公共文本。

文案归属按以下顺序判断：

1. 只在某个页面或页面子组件中使用：放在该页面目录附近的 `i18n/`，或所属 feature 的 `i18n/`
2. 只在某个 feature 内多个页面复用：放在该 feature 的 `i18n/`
3. app shell、全局布局、路由导航使用：放在 `desktop/src/app/i18n/`
4. shared UI 组件内部默认文案：放在 `desktop/src/shared/ui/i18n/`
5. 真正跨全应用复用的基础文案：放在 `desktop/src/shared/i18n/`

## Key 结构

全局 `translation` 命名空间内的 feature 文案应以 feature 名作为一级 key。

示例：

```ts
const dashboard = {
  dashboard: {
    home: {
      enterChat: "进入对话",
      logout: "退出登录",
    },
  },
} as const;
```

组件中使用：

```tsx
const { t } = useTranslation();

return <Button>{t("dashboard.home.enterChat")}</Button>;
```

页面或大型子域需要完全隔离时，可以使用独立 namespace。比如角色页在页面入口导入自己的 `i18n` 注册文件，再通过局部 hook 使用：

```tsx
import "./i18n";
import { useRoleTranslation } from "./i18n/useRoleTranslation";

const t = useRoleTranslation();
```

独立 namespace 更适合较大的页面子域；普通页面文案优先继续并入 feature shard，减少注册入口。

## 注册方式

feature 级 shard 需要在 `desktop/src/shared/i18n/index.ts` 中显式引入，并加入对应语言的 `shards` 数组：

```ts
import dashboardZh from "@/features/dashboard/i18n/zh-CN";
import dashboardEn from "@/features/dashboard/i18n/en-US";

const shards = {
  "zh-CN": [dashboardZh],
  "en-US": [dashboardEn],
} as const;
```

独立 namespace 由页面入口负责导入注册文件。注册文件使用 `i18n.addResourceBundle(...)`，页面卸载时不需要清理。

## 使用规则

- 新增可见文案时，同一 change 内必须同时补齐 `zh-CN` 与 `en-US`
- key 使用稳定语义，不使用中文或完整句子当 key
- 不在组件中拼接翻译句子；需要变量时使用插值，例如 `t("x.y", { count })`
- 按钮、标题、空态、错误、toast、aria label 都属于可见文案，必须走 i18n
- 业务常量、导出报告、非 React 工具函数需要文案时，可以从 `@/shared/i18n` 导入默认 `i18n`，并用 `getAppLanguage()` 或 `getFixedT()` 固定当前语言
- shared UI 组件不要依赖 feature 文案 key；feature 页面也不要把自身业务文案放进 shared UI 的 i18n 文件

## 修改已有文案时

移动或新增页面文案时，优先把它收口到页面或 feature 内部 i18n 文件。

如果发现 `desktop/src/shared/i18n/*.ts` 中有明显页面专属文案，后续改到相关页面时应顺手迁移；迁移时只移动同一业务范围内的 key，不做大规模跨 feature 重排。
