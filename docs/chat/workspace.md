---
status: current
owner: chat / runtime / harness
last_verified: 2026-08-01
layer: wiki
module: Chat / Tool
feature: ChatWorkspace
doc_type: current-contract
canonical: true
related:
  - ../CHAT_CURRENT_TRUTH.md
  - README.md
  - ../TOOL_CURRENT_TRUTH.md
  - ../harness/README.md
  - ../../server/src/skills/development/miradocs/SKILL.md
  - ../../server/src/skills/development/miradocs/references/create-site.md
---

# Chat Workspace 与默认执行空间当前合同

> 本页统一 `ChatWorkspace`、`Mira BASE`、物理目录、Harness workspace root 和受管施工目录的语义。数据库对象、文件系统目录和一次任务的施工现场不是同一个东西。

## 1. 四个必须分开的对象

```text
ChatWorkspace
  数据库中的工作空间记录

Mira BASE
  默认 ChatWorkspace 的逻辑名称

Harness workspace root
  当前 Agent / Tool 执行环境使用的物理根路径

Task staging workspace
  某次建站、构建或其他施工任务使用的受管子目录
```

它们的关系是：

```text
Mira BASE (database row)
  -> rootPath
  -> Harness workspace root
  -> optional .mira/staging/... task directories
```

但不能反向等同：

```text
Mira BASE
!= 文件夹名称

workspaceId
!= 文件系统路径

Harness workspace root
!= 某次任务可直接污染的施工目录
```

## 2. 内置默认空间

桌面应用内置的默认物理路径为操作系统 Documents 目录下：

```text
UIChat Mira/Default Workspace
```

Windows 典型路径：

```text
C:\Users\<user>\Documents\UIChat Mira\Default Workspace
```

打包后的 Electron 与 Tauri 都应由桌面启动器解析该路径，并通过：

```text
UI_CHAT_WORKSPACE_ROOT
```

传给 bundled backend。

Backend 在需要默认 ChatWorkspace 时，复用或创建数据库记录：

```text
name = Mira BASE
rootPath = UI_CHAT_WORKSPACE_ROOT
```

因此：

- `Default Workspace` 是内置物理目录名；
- `Mira BASE` 是默认数据库 Workspace 名；
- 两者通过 rootPath 绑定，不应混成同一个 UI / 文件系统概念。

## 3. 谁负责创建目录

### 3.1 内置默认目录

内置默认目录属于桌面宿主拥有的 bootstrap 资源。

```text
Electron / Tauri launcher
  -> resolve Documents/UIChat Mira/Default Workspace
  -> create directory recursively
  -> verify it is a directory
  -> start backend with UI_CHAT_WORKSPACE_ROOT
```

生产启动必须在 backend spawn 之前完成创建。目录创建失败时，桌面启动失败并展示明确路径错误；不能先启动 backend，再等待某次 Tool 调用碰巧创建。

开发 launcher 使用默认路径时遵守同一语义：先创建，再启动 server。显式提供 `UI_CHAT_WORKSPACE_ROOT` 时按自定义目录合同处理。

### 3.2 自定义 Workspace

用户选择、数据库保存或环境变量显式指定的自定义 Workspace 属于用户 / 部署者拥有的路径。

对自定义路径：

- 选择和读取只验证路径；
- 路径必须已经存在并且是目录；
- 路径不存在时返回明确 unavailable / not found；
- 不因读取 Workspace、创建 environment snapshot 或启动一次 Tool 而偷偷创建；
- 用户删除目录后，不得自动“复活”一个同名空目录；
- 新目录创建必须来自明确用户动作或经过审批的文件系统操作。

独立 server 部署若通过 `UI_CHAT_WORKSPACE_ROOT` 指定自定义根目录，由部署者预先创建并赋予权限；backend 不把任意环境变量路径当成可自动初始化的产品目录。

## 4. Harness snapshot 必须是纯读取

`getWorkspaceSelection()` 和 Harness environment snapshot 表达当前执行事实：

```text
rootPath
source = selected | configured | unset
```

它们不得产生文件系统副作用。

正确顺序：

```text
host / user explicitly establishes a workspace
→ selection records the path
→ snapshot reads the path
→ Tool validates and executes
```

错误顺序：

```text
snapshot reads a missing path
→ mkdir as hidden fallback
→ Tool unknowingly runs in a newly created empty directory
```

默认目录的 bootstrap 创建属于宿主启动职责，不能下沉到通用 Workspace getter。

## 5. 默认 Workspace 的数据库语义

Agent Thread 必须绑定 ChatWorkspace。启用 Agent 时若没有显式选择：

```text
ensure Mira BASE database row
→ bind current Harness workspace root
→ attach workspaceId to Thread
```

数据库记录存在只证明路径配置已经绑定，不证明：

- 物理目录一定存在；
- 目录可写；
- 当前任务已经拥有独立施工现场；
- 目录中已有项目或仓库。

物理路径有效性必须由启动 / 选择合同和具体 Tool 执行共同验证。

## 6. 受管内部目录

Mira 可以在自己拥有的内置默认空间下保留内部目录：

```text
<workspaceRoot>/.mira/
```

`.mira` 不作为普通项目根目录宣传给用户，也不允许任务把内部索引、缓存、临时构建和用户项目文件混在 Workspace 根层。

建议用途：

```text
.mira/
  staging/
  cache/
  indexes/
```

具体子系统只能使用自己声明的子目录，并遵守清理、恢复和可观测性合同。

## 7. MiraDocs GitHub 建站施工目录

GitHub 建站需要同时使用：

```text
GitHub remote operations
+ local install / typecheck / build verification
```

因此 GitHub 模式不能直接把 `Mira BASE` 根目录当成站点目录。它使用受管 task staging workspace：

```text
<workspaceRoot>/.mira/staging/miradocs/<owner>/<repo>/<taskKey>/
```

其中：

- `taskKey` 在任务首次进入本地施工时生成一次；
- exact staging path 必须进入 SubAgent checkpoint / working state，恢复时复用；
- 同一任务失败后保留现场，不从头重新初始化；
- 不同仓库或并发任务不能共享同一目录；
- 写远程前后都要回读 GitHub 状态；
- 本地 build 成功只证明 staging 内容可构建，不等于远程分支、PR、Actions 或 Pages 成功。

本地模式使用用户明确的 `target.localPath`，不强制迁入 `.mira/staging`。

## 8. 当前实现缺陷与本次整改边界

截至 `dev` 的已确认缺陷：

1. Electron / Tauri 生产启动器计算并传递默认路径，但没有在 backend spawn 前显式创建 `Default Workspace`。
2. Terminal 消费 Harness snapshot 时会把该路径当成真实 cwd，首次使用可能报 `terminal cwd does not exist`。
3. 在通用 `getWorkspaceSelection()` 中隐式 mkdir 虽能掩盖默认目录缺失，却会误伤自定义 Workspace 语义，因此不是可接受修复。
4. MiraDocs GitHub 路由声明了远程 GitHub 能力和本地构建完成标准，但此前没有定义独立 staging path。

本次整改只应：

- 在 Electron / Tauri 及对应 dev launcher 中创建宿主拥有的默认目录；
- 保持 Workspace selection / snapshot 纯读取；
- 对自定义缺失路径明确失败；
- 为 MiraDocs GitHub 模式建立受管 staging 合同；
- 不改变 Agent Graph、Policy、审批指纹或 Terminal 的 host runtime 能力。

## 9. 验收标准

- 全新安装首次启动后，默认物理目录在 backend 启动前存在；
- `Mira BASE.rootPath` 与宿主传入路径一致；
- 删除自定义 Workspace 后，读取或执行不会创建同名空目录；
- Terminal 在默认空间运行不再出现首次 cwd missing；
- GitHub 建站的本地文件位于 task staging，而不是 Workspace 根目录；
- staging 路径可在 approval / failure / resume / trace 中核验；
- GitHub、构建、PR、Actions、Pages 的完成状态仍分别回读，不互相冒充。
