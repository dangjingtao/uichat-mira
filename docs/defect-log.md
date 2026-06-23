# 缺陷台账（Defect Log）

## 目的

本文档用于集中跟踪 `0.5.2` 阶段聊天系统相关缺陷、技术债与验证结论。格式参考常见缺陷管理实践，保留以下核心字段：

- 缺陷编号
- 标题
- 状态
- 严重度（Severity）
- 优先级（Priority）
- 影响版本
- 环境
- 复现步骤
- 期望结果
- 实际结果
- 根因 / 假设
- 临时绕过方案
- 解决方案
- 验证记录

## 字段说明

### 状态

| 状态 | 说明 |
|------|------|
| Open | 已确认，待处理 |
| In Progress | 已进入修复或验证中 |
| Blocked | 有明确阻塞，当前无法推进 |
| Mitigated | 已有临时缓解方案，但未根治 |
| Resolved | 代码已修复，待回归确认 |
| Verified | 已完成修复并通过验证 |
| Known Debt | 当前可用，但保留为后续技术债 |

### 严重度

| 级别 | 说明 |
|------|------|
| Critical | 核心链路不可用，阻断主要功能 |
| High | 关键能力明显受损，有清晰用户影响 |
| Medium | 存在功能缺陷或体验退化，但有替代路径 |
| Low | 局部体验、文案、边界行为问题 |

### 优先级

| 级别 | 说明 |
|------|------|
| P0 | 必须立即处理，阻塞当前交付 |
| P1 | 当前迭代优先处理 |
| P2 | 可排入后续修复 |
| P3 | 观察或延后处理 |

## 汇总表

| ID | 标题 | 影响版本 | 严重度 | 优先级 | 状态 | 目标版本 |
|----|------|----------|--------|--------|------|----------|
| BUG-001 | 默认 Cloudflare Provider 配置无效导致对话失败 | 0.5.2 | High | P0 | Verified | 0.5.2 |
| BUG-002 | 首轮取消后线程标题可能退化为无意义短标题 | 0.5.2 | Medium | P2 | Open | 待定 |
| BUG-003 | 重新生成成功链路尚未完成跨 Provider 回归闭环 | 0.5.2 | Medium | P1 | In Progress | 待定 |
| DEBT-001 | 历史图片在多轮对话中采用发送前裁剪方案 | 0.5.2 | Medium | P2 | Known Debt | 待定 |
| DEBT-002 | 请求体大小通过放宽 body limit 临时兜底 | 0.5.2 | Medium | P2 | Known Debt | 待定 |
| DEBT-003 | 附件元数据存在持续膨胀风险 | 0.5.2 | Medium | P2 | Mitigated | 待定 |
| BUG-004 | 输入态 / 失败态 / 取消态专项回归尚未系统完成 | 0.5.2 | Medium | P1 | Open | 待定 |
| BUG-005 | 助手消息复制 / 重新生成按钮被用户消息 hover 策略误隐藏 | 0.5.2 | Medium | P1 | Resolved | 0.5.2 |
| BUG-006 | Provider 连接配置重启后被默认 seed 覆盖 | 0.5.2 | High | P0 | Resolved | 0.5.2 |
| BUG-007 | RAG 线程发送消息未携带 thread id 导致知识库链路被跳过 | 0.5.2 | High | P0 | Verified | 0.5.2 |
| BUG-008 | RAG stream finish 事件携带 usage 导致旧运行时校验失败 | 0.5.2 | High | P0 | Verified | 0.5.2 |
| BUG-009 | 助手消息重新生成完成后触发 React removeChild 崩溃 | 0.5.2 | High | P0 | Resolved | 0.5.2 |
| GAP-001 | Cloudflare 多模态文档核对未完全闭环 | 0.5.2 | Low | P3 | In Progress | 待定 |

## 详细记录

### BUG-001 默认 Cloudflare Provider 配置无效导致对话失败

- 状态：Verified
- 严重度：High
- 优先级：P0
- 影响版本：0.5.2
- 环境：桌面聊天界面，默认 `llm` 指向 Cloudflare
- 现象：
  - 修复前，普通对话与重新生成会失败。
  - 修复前表现为模糊的下游鉴权错误；修复后先补了显式配置校验，再补了“设默认模型时同时入库连接信息”的闭环。
- 复现步骤：
  1. 使用当前默认模型配置进入聊天页。
  2. 直接发送消息或点击 `重新生成`。
  3. 观察请求失败与错误提示。
- 期望结果：
  - 默认模型可直接工作，或初始化阶段就阻止无效配置进入运行时。
- 实际结果：
  - 历史问题已修复。
  - 当前默认 Cloudflare 配置已可正确保存真实 `baseUrl` 和 `apiKey`，默认聊天已验证可出字。
- 根因 / 假设：
  - `model_configs` 默认 `llm` 绑定了 Cloudflare 模型。
  - 历史上 `provider_connections.cloudflare.base_url` 仍包含 `<ACCOUNT_ID>` 占位符，且 `api_key_encrypted` 为空。
  - 旧设置流程将“保存连接信息”和“设置默认模型”拆成两个请求，容易出现默认模型已切换但连接信息未落库的状态。
- 临时绕过方案：
  - 当前无需绕过。
- 已实施修复：
  - 增加 Provider preflight 校验，配置无效时直接报明确错误。
  - 设置默认角色模型时，同时提交并持久化当前 `baseUrl` 与 `apiKey`。
- 解决方案：
  - 保留现有 preflight 校验，避免错误继续以下游 401 形式泄漏。
  - 继续沿用“设置默认模型时一并保存连接信息”的原子化交互。
- 验证记录：
  - 已确认 `GET /providers` 返回的 Cloudflare `baseUrl` 为真实账号地址，`hasApiKey` 为 `true`。
  - 已确认 `GET /models` 返回默认 `llm` 仍绑定 `cloudflare / @cf/moonshotai/kimi-k2.7-code`。
  - 已通过 Codex 内置浏览器手工登录并发送 `你好，请只回复 ok`，默认聊天成功返回 `ok`。
  - 刷新后页面保持“默认新对话空态，不自动选中历史线程”，左侧历史保留刚创建的 `你好对话` 线程。

### BUG-002 首轮取消后线程标题可能退化为无意义短标题

- 状态：Open
- 严重度：Medium
- 优先级：P2
- 影响版本：0.5.2
- 环境：新线程首轮发送后立即取消
- 现象：
  - 首轮取消后，线程标题可能生成质量较差的短文本，例如 `1`。
- 复现步骤：
  1. 新建线程。
  2. 发送首轮消息。
  3. 在生成过程中取消。
  4. 刷新后观察线程标题。
- 期望结果：
  - 取消不应生成低质量标题，或应保留默认标题直到后续有效内容出现。
- 实际结果：
  - 数据不再丢失，但标题仍可能不合理。
- 根因 / 假设：
  - 现已通过 `messageCount === 0` 避免空线程误命名。
  - 剩余问题在于标题生成时机与首轮取消内容质量控制不足。
- 临时绕过方案：
  - 手动重命名线程。
- 解决方案：
  - 收紧取消态下的标题生成条件。
  - 仅在存在稳定用户输入且轮次完成后再更新标题。
- 验证记录：
  - 线程 `e59f1b6a6cbdac7a20906c390c238e84` 已确认数据保留正常。
  - 当前残留问题仅为标题质量，不再是消息丢失。

### BUG-003 重新生成成功链路尚未完成跨 Provider 回归闭环

- 状态：In Progress
- 严重度：Medium
- 优先级：P1
- 影响版本：0.5.2
- 环境：带历史消息的线程，触发 `重新生成`
- 现象：
  - 重新生成入口已恢复。
  - 历史恢复后可再次看到该入口。
  - 但成功链路尚未在多 Provider 下完成系统回归。
- 复现步骤：
  1. 打开已有 assistant 历史消息的线程。
  2. 点击 `重新生成`。
  3. 观察生成、失败、刷新后的历史一致性。
- 期望结果：
  - 在不同 Provider 下均可稳定重新生成，且不污染原有历史。
- 实际结果：
  - 当前失败链路已稳定，不会破坏持久化历史。
  - 成功链路仍受默认 Provider 配置问题和专项回归覆盖不足影响。
- 根因 / 假设：
  - 一部分问题已由历史恢复 parentId 修复。
  - 剩余问题主要是回归覆盖不足，而非单点实现完全不可用。
- 临时绕过方案：
  - 使用已验证可工作的 Provider 做定向验证。
- 解决方案：
  - 分 Provider 完成成功重试、失败重试、带附件上下文重试验证。
  - 明确重新生成与编辑后的消息持久化约束。
- 已实施修复：
  - 2026-06-19 已补做“线性尾部替换”持久化：
    - 非 RAG `createMessage` 支持 `parentId` / `metadata.lineage.parentId`，服务端在重新生成或编辑后会裁掉旧尾巴再保存。
    - RAG `/proxy/chat/default` 分支在 latest user message 上对齐尾部，重新回答不会继续向同一问题后面叠加多条 assistant。
    - 前端历史加载增加连续 assistant 线性投影，旧脏数据下优先显示最后一条有效回答。
- 验证记录：
  - 线程 `b24bcd0a1dde2c05d5a173d43833f85a` 已确认历史恢复后 `重新生成` 可见。
  - 当前失败重试不会破坏原有历史记录。
  - 2026-06-19 回归时，线程 `测试需求咨询` 的 DOM 中可见 `复制` 与 `重新生成` 操作入口。
  - 同次回归暴露助手消息操作区被 hover 透明度策略误隐藏，已拆分为 `BUG-005` 跟踪。
  - 2026-06-19 内置浏览器回归发现重新生成完成后触发 ErrorBoundary，已拆分为 `BUG-009`，因此重新生成闭环不能标记完成。
  - 2026-06-19 API 回归通过：
    - 非 RAG assistant 重新生成：同一 user 之后仅保留最新 assistant。
    - 非 RAG user 编辑后重新生成：旧 tail 被裁掉，只保留新的 user + assistant。
    - RAG assistant 重新回答：同一 user 之后只保留一条 assistant，不再写出连续重复回答。
    - RAG user 改写后重新回答：线程尾部切换到新的 user + assistant 线性链路。
  - 2026-06-19 主界面内置浏览器手工回归通过：
    - 用户消息操作区新增显式 `重新生成`，点击后直接以最近一条 user message 为父节点发起新运行，不再依赖“原文不变的编辑提交”。
    - 助手消息 `重新生成` 点击后可进入 loading / RAG trace，并正常替换尾部回答。
    - 编辑态补齐 `MessagePrimitive.Root` 上下文后，用户改写消息再 `生成` 能真正触发请求，不再只退出编辑态。
  - 仍缺：
    - 取消态、失败态、跨 Provider 稳定性还未做完系统回归。

### DEBT-001 历史图片在多轮对话中采用发送前裁剪方案

- 状态：Known Debt
- 严重度：Medium
- 优先级：P2
- 影响版本：0.5.2
- 环境：用户连续多轮发送图片相关消息
- 现象：
  - 当前为避免每轮重复携带整段历史图片，请求发送前会裁剪历史附件。
- 期望结果：
  - 图片上下文传输与持久化有明确架构，不依赖前端临时裁剪。
- 实际结果：
  - 主链路已恢复可用，但方案偏临时。
- 风险：
  - 未来可能出现历史图片语义丢失、Provider 行为不一致、上下文不可预测。
- 临时绕过方案：
  - 保持当前裁剪策略，避免大包和重复发送。
- 解决方案：
  - 设计附件引用式传输或后端附件复用机制，替代重复内联。
- 验证记录：
  - 当前多轮图片主链路已恢复，不再因历史图片重复上传直接崩溃。

### DEBT-002 请求体大小通过放宽 body limit 临时兜底

- 状态：Known Debt
- 严重度：Medium
- 优先级：P2
- 影响版本：0.5.2
- 环境：图片附件、较大消息体
- 现象：
  - 为绕过图片请求进入业务逻辑前被 `413` 或等价限制拦截，服务端放宽了请求体上限。
- 期望结果：
  - 大体积附件具备更稳的传输与存储方案，而不是单纯增大 body limit。
- 实际结果：
  - 当前可用性提高，但未从根上解决大包问题。
- 风险：
  - 上传规模继续增长时，仍可能出现性能、内存、持久化压力。
- 临时绕过方案：
  - 保持当前 body limit。
- 解决方案：
  - 后续评估独立附件上传、引用式消息体、服务端对象存储或分段传输。
- 验证记录：
  - 当前图片消息已可进入业务逻辑，不再在入口阶段直接失败。

### DEBT-003 附件元数据存在持续膨胀风险

- 状态：Mitigated
- 严重度：Medium
- 优先级：P2
- 影响版本：0.5.2
- 环境：线程长期使用附件、多轮对话累计
- 现象：
  - 附件元数据与持久化消息体可能持续增大。
- 期望结果：
  - 消息表中仅保留必要元信息，大内容通过可复用引用或外部存储管理。
- 实际结果：
  - 新上传图片已改为项目内部附件 URL，消息 metadata 不再保存 WebP base64。
  - 历史已入库的 base64 附件仍需后续迁移或自然淘汰。
- 风险：
  - 后续再次触发大包、恢复变慢、DB 体积增长过快。
- 临时绕过方案：
  - 继续控制发送链路中的历史附件规模。
- 解决方案：
  - 收敛消息层 metadata 体积，明确附件内容与引用的边界。
- 已实施修复：
  - 新增 `POST /attachments` 保存图片到 `server/data/attachments`。
  - 使用 `@fastify/static` 通过 `/attachments/*` 暴露内部附件。
  - 前端 WebP adapter 上传后只把 `/attachments/<id>.webp` 写入消息附件内容。
  - 后端 Provider 代理在调用模型前把内部附件 URL 解析回 data URL/base64，保持 OpenAI-compatible 与 Ollama 兼容。
- 验证记录：
  - 2026-06-19 已通过接口验证上传返回 `/attachments/<uuid>.webp`。
  - 2026-06-19 已验证静态读取返回 `Content-Type: image/webp`。

### BUG-004 输入态 / 失败态 / 取消态专项回归尚未系统完成

- 状态：Open
- 严重度：Medium
- 优先级：P1
- 影响版本：0.5.2
- 环境：聊天 UI 多状态交互
- 现象：
  - 关键状态已有一轮修复，但尚未完成统一回归清单执行。
- 待回归场景：
  1. 取消后再次发送。
  2. 附件消息失败后的重试。
  3. 模型报错后的恢复路径。
  4. 多 Provider 下加载、失败、取消状态的一致性。
  5. 首轮取消态的真实 UI 手工回归。
- 期望结果：
  - 各状态切换行为、按钮显隐、消息保留与线程标题都稳定一致。
- 实际结果：
  - 现阶段更接近“局部已修复，系统回归未完成”。
- 解决方案：
  - 按既有测试清单逐条执行，补齐记录与截图。

### BUG-005 助手消息复制 / 重新生成按钮被用户消息 hover 策略误隐藏

- 状态：Resolved
- 严重度：Medium
- 优先级：P1
- 影响版本：0.5.2
- 环境：桌面聊天界面，已有 assistant 历史消息下方操作区
- 现象：
  - 助手消息下方 `复制` / `重新生成` 按钮 DOM 已挂载，但操作区被统一套用了用户消息的 `opacity-0 group-hover` 显隐策略。
  - 在回归中，按钮存在但计算样式为透明，用户视觉上等同于“按钮消失”。
- 复现步骤：
  1. 打开已有 assistant 历史消息的线程。
  2. 观察 assistant 消息下方操作区。
  3. 检查 `复制` / `重新生成` 是否可见。
- 期望结果：
  - 助手消息下方 `复制` / `重新生成` 默认可见或按原有交互稳定显示。
  - 用户消息下方 `复制` / `编辑` 可继续使用预留高度和 hover 渐显，避免聊天区抖动。
- 实际结果：
  - 修复前，助手消息按钮被用户消息 hover 策略误隐藏。
  - 修复后，`MessageActions` 增加 `fadeOnHover` 参数，仅用户消息启用 hover 渐显；助手消息保持 `opacity-100`。
- 根因 / 假设：
  - 统一消息操作区时将用户消息的隐藏策略抽到共用组件，但未区分 assistant 消息的原有行为。
  - assistant 消息根节点虽补了 `group`，但自动化回归仍确认操作区处于透明状态，因此应恢复助手操作区常显。
- 临时绕过方案：
  - 无需绕过，代码已修复。
- 已实施修复：
  - `desktop/src/features/chat/components/Thread/index.tsx` 中 `MessageActions` 支持 `fadeOnHover`。
  - 用户消息调用 `MessageActions allowEdit fadeOnHover`。
  - 助手消息调用 `MessageActions allowReload`，操作区使用 `opacity-100`。
- 解决方案：
  - 保留当前差异化策略。
  - 后续 UI 评审时再统一决定 assistant 操作区是否需要延迟显隐，但不得影响可发现性。
- 验证记录：
  - 2026-06-19 已通过内置浏览器在修复前确认历史线程中存在 `复制` 与 `重新生成` DOM。
  - 2026-06-19 已确认修复前按钮操作区计算样式为 `opacity: 0`，且外层预留高度为 `28px`。
  - 2026-06-19 已完成代码修复并通过 `pnpm --filter @ui-chat-rag-tester/desktop typecheck` 与 `pnpm check`。
  - 修复后的最终浏览器点击确认被 Codex 内置浏览器 webview attach 超时阻断，因此状态保持 `Resolved`，待下一轮手工回归后再改 `Verified`。

### BUG-006 Provider 连接配置重启后被默认 seed 覆盖

- 状态：Resolved
- 严重度：High
- 优先级：P0
- 影响版本：0.5.2
- 环境：设置页 Provider 配置，Cloudflare / OpenAI Compatible 等外部平台连接信息
- 现象：
  - 用户设置默认模型时，前端已把当前 `baseUrl` 与 `apiKey` 传给后端。
  - 但应用重启后，Cloudflare 回显重新变为默认占位 URL：`https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1`。
  - 同时 `hasApiKey=false`，状态退回 `idle`，界面显示“待连接”。
- 复现步骤：
  1. 在设置页选择 Cloudflare。
  2. 填写真实 `baseUrl` 与 `apiKey`，同步模型并设置默认 LLM。
  3. 重启后端 / 应用。
  4. 再次打开 Cloudflare 设置页。
- 期望结果：
  - 重启后仍回显真实 `baseUrl`。
  - 已保存的密钥状态仍为 `hasApiKey=true`。
  - 连接状态不应被默认 seed 重置。
- 实际结果：
  - 修复前，启动初始化会把已有 `provider_connections` 记录覆盖回默认配置。
  - 当前现场 DB 已被覆盖，Cloudflare 真实 `apiKey` 无法从应用侧恢复，需要用户重新保存一次。
- 根因 / 假设：
  - `initializeModelConfigDatabase()` 创建表后遍历 `DEFAULT_PROVIDER_CONNECTIONS`。
  - 旧逻辑对每个默认 Provider 直接调用 `providerConnectionRepository.upsert()`。
  - `upsert()` 在记录已存在时会更新 `baseUrl`、`apiKeyEncrypted`、`status` 等字段，导致用户配置每次启动都被 seed 覆盖。
- 临时绕过方案：
  - 修复前只能每次重启后重新填写 Cloudflare 连接信息。
- 已实施修复：
  - `server/src/db/model-config.db.ts` 中默认 Provider seed 改为“仅记录不存在时插入”。
  - 已存在的 provider 连接不再被启动初始化覆盖。
- 解决方案：
  - 保留默认 seed 只插入缺失记录的策略。
  - 如果未来需要更新 displayName 等 catalog 信息，应单独迁移非敏感字段，不能覆盖用户连接字段。
- 验证记录：
  - 2026-06-19 已确认当前接口 `GET /providers/cloudflare` 返回默认占位 `baseUrl` 且 `hasApiKey=false`，与用户截图一致。
  - 2026-06-19 已完成代码修复并通过 `pnpm --filter @ui-chat-rag-tester/server typecheck`。
  - 待用户重新保存真实 Cloudflare 配置后，重启应用再验证回显；通过后状态可改为 `Verified`。

### BUG-007 RAG 线程发送消息未携带 thread id 导致知识库链路被跳过

- 状态：Verified
- 严重度：High
- 优先级：P0
- 影响版本：0.5.2
- 环境：聊天页开启知识库检索后，发送普通消息
- 现象：
  - UI 中线程已开启 RAG，但回答下方没有 RAG 执行链路，也没有参考来源区域。
  - 后端日志显示请求进入 `/proxy/chat/default`，但没有 `rag-branch-enter`。
  - 线程数据中 `ragEnabled=true`，但本轮 assistant 回复未以 RAG metadata 持久化。
- 复现步骤：
  1. 在聊天线程中开启知识库检索。
  2. 发送一条普通问题。
  3. 观察助手回复下方是否出现 RAG 链路与来源。
- 期望结果：
  - `/proxy/chat/default` 能识别当前 remote thread id。
  - 后端在 `thread.ragEnabled=true` 且存在有效 user question 时进入 RAG 分支。
  - 前端能收到 `data-rag-node`，并显示 RAG 执行链路。
- 实际结果：
  - 修复前，前端 transport 请求体没有稳定携带当前 remote thread id。
  - 后端 `request.body.id` 缺失时无法查询线程配置，因此直接降级到普通 LLM。
- 根因 / 假设：
  - `useChatRuntime` 的 `prepareSendMessagesRequest` 只覆盖了 `messages`。
  - 旧运行时原始请求体不保证包含本项目后端需要的 remote thread id。
  - RAG 分支条件依赖 `request.body.id`，缺失时没有显式 UI 提示，表现为“像普通聊天一样回复”。
- 临时绕过方案：
  - 无稳定用户侧绕过；只能手动调用带 `id` 的后端接口验证 RAG。
- 已实施修复：
  - 新增 `desktop/src/features/chat/Providers/threadRuntimeBridge.ts`，由 `CurrentThreadProvider` 同步当前 remote thread id。
  - `BaseLayout` 的 `prepareSendMessagesRequest` 在请求体补充 `id` 和最新 user `messageId`。
  - 后端在 RAG 开启但分支被跳过时记录 `rag-branch-skipped`，避免后续静默降级。
- 解决方案：
  - 保持 transport 请求显式携带 thread id。
  - 后续可考虑把 thread id 传递继续下沉到统一运行时上下文，减少模块级 bridge。
- 验证记录：
  - 2026-06-19 已确认问题线程 `56c86c3da64fad499d8156bec643ccff` 的 `ragEnabled=true`，但修复前只持久化了 user 消息。
  - 2026-06-19 使用带 `id` 的 `/proxy/chat/default` API 回归，响应开头出现 `data-rag-node`。
  - 2026-06-19 日志出现 `rag-branch-enter`，确认后端进入 RAG 分支。
  - 2026-06-19 已通过 `pnpm check`。
  - 2026-06-19 使用内置浏览器新建 RAG 线程并发送消息，日志出现 `rag-branch-enter`，页面出现“执行过程”链路。

### BUG-008 RAG stream finish 事件携带 usage 导致旧运行时校验失败

- 状态：Verified
- 严重度：High
- 优先级：P0
- 影响版本：0.5.2
- 环境：聊天页开启知识库检索后，RAG data stream 完成阶段
- 现象：
  - 后端已进入 RAG 分支，日志存在 `rag-branch-enter`、`retrieve-complete`、`rerank-enter`。
  - 页面已收到回答文本，但助手消息下方显示“生成失败，请稍后重试”。
  - 错误详情包含 `Type validation failed`，并指向 `type: "finish"` 事件中的 `usage` 字段不被当前运行时 / AI SDK UI message chunk 校验接受。
- 复现步骤：
  1. 新建聊天线程。
  2. 开启知识库检索。
  3. 发送一条普通问题。
  4. 等待 RAG stream 完成。
- 期望结果：
  - RAG stream 正常结束。
  - 页面不显示生成失败。
  - 助手消息下方显示 RAG 执行链路。
- 实际结果：
  - 修复前，回答文本显示后被协议校验错误标记为失败。
  - RAG 执行链路未稳定展示，用户感知为“知识库链路没出来”。
- 根因 / 假设：
  - `server/src/services/chat-stream-events.ts` 的 `assistantFinishChunk()` 在 `finish` 事件里附带 `usage`。
  - 当前本地依赖组合中的旧运行时流消费层与 `ai@6.0.197` 在该字段上不兼容。
  - 该 UI message chunk 类型允许 `finishReason` 与 `messageMetadata`，不接受 `usage`。
- 临时绕过方案：
  - 无稳定用户侧绕过；只能忽略 UI 错误并从后端日志确认 RAG 已执行。
- 已实施修复：
  - 移除 `finish` stream chunk 中的 `usage` 字段。
  - 保留调用侧 `usage` 参数，减少当前改动面，后续如需 token 统计应走官方支持的 metadata / message metadata 方案。
- 解决方案：
  - RAG stream 严格按当前运行时 / AI SDK UI message chunk 兼容字段输出。
  - 后续新增 stream 字段前需先对照本地依赖版本的类型定义与浏览器回归。
- 验证记录：
  - 2026-06-19 已通过 `pnpm --filter @ui-chat-rag-tester/server typecheck`。
  - 2026-06-19 使用内置浏览器发送第二轮 RAG 消息，浏览器控制台无 error / warn。
  - 2026-06-19 日志确认第二轮请求进入 `rag-branch-enter`，且 `historyCount=2`。
  - 2026-06-19 页面出现“执行过程 · 已完成检索与回答组织，可展开查看来源和过程 5”。

### BUG-009 助手消息重新生成完成后触发 React removeChild 崩溃

- 状态：Resolved
- 严重度：High
- 优先级：P0
- 影响版本：0.5.2
- 环境：聊天页普通线程，点击助手消息下方 `重新生成`
- 现象：
  - 重新生成入口可见，点击后能进入加载态。
  - 生成完成附近页面触发 ErrorBoundary。
  - 页面同时出现正常聊天 main 与错误边界 main，用户需要重试或刷新。
- 复现步骤：
  1. 新建普通聊天线程。
  2. 发送一条普通消息。
  3. 在助手消息下方点击 `重新生成`。
  4. 等待重新生成结束。
- 期望结果：
  - 重新生成完成后，助手消息正常更新。
  - 输入框恢复可用，页面不进入错误边界。
  - 历史消息与操作区保持一致。
- 实际结果：
  - 浏览器控制台出现 `Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.`
  - 同时出现 `ReactDOMClient.createRoot()` 重复创建 root 警告。
  - ErrorBoundary 展示“页面暂时出了点问题”。
- 根因 / 假设：
  - 疑似旧运行时重新生成完成后的消息分支替换，与当前自定义 history adapter / `CurrentThreadProvider` 刷新线程状态同时修改消息树，导致 React 删除已被替换的 DOM 节点。
  - 也可能与重新生成完成后触发标题同步 / thread fetch / history reload 的时序冲突有关。
- 临时绕过方案：
  - 用户侧只能刷新应用或避免使用重新生成。
- 解决方案：
  - 收敛重新生成完成后的刷新时序，避免运行时消息树仍在 commit 时强制 reload/thread state 替换。
  - 复查 `ThreadHistoryAdapter.append/load`、`CurrentThreadProvider.refreshThreadState()` 与旧 reload 行为的交互。
  - 修复后需覆盖普通线程、RAG 线程、取消后重新生成三类回归。
- 已实施修复：
  - `desktop/src/main.tsx` 复用已有 React root，避免 dev/HMR 或页面重建时对同一容器重复 `createRoot()`。
  - 该修复直接对应回归日志中的 `ReactDOMClient.createRoot()` 重复创建警告。
- 验证记录：
  - 2026-06-19 内置浏览器回归复现。
  - 同次回归确认加载态可见：输入框 disabled、提示“正在生成回复，可随时取消”、按钮“取消生成”。
  - 同次回归确认取消后输入框恢复且控制台无新增错误，但未出现明确“已取消”状态文案。
  - 2026-06-19 已通过 `pnpm check`。
  - 2026-06-19 浏览器登录输入被 Browser 插件虚拟剪贴板问题阻断，页面级重新生成回归仍需用户侧或浏览器恢复后确认。

### GAP-001 Cloudflare 多模态文档核对未完全闭环

- 状态：In Progress
- 严重度：Low
- 优先级：P3
- 影响版本：0.5.2
- 环境：Cloudflare Provider，多模态消息
- 现象：
  - 工程兼容已做到当前可用，但官方文档核对仍有空白。
- 已确认项：
  - OpenAI 兼容 base URL 结构。
  - `/v1/chat/completions` 与 `/v1/embeddings` 可用路径。
  - `@cf/...` 模型 ID 形式。
- 未闭环项：
  - 官方文档未直接给出 vision 场景 `image_url` 请求示例。
- 期望结果：
  - Cloudflare 聊天与图片消息的兼容策略有文档级依据，不只依赖推断与实测。
- 实际结果：
  - 当前仍属于“工程可用，但文档闭环不足”。
- 解决方案：
  - 继续按官方文档补核，必要时记录“实测兼容，文档未明示”的边界说明。

## 维护规则

1. 新缺陷先补汇总表，再补详细记录。
2. `Resolved` 仅表示代码已改；完成手工或自动回归后再改为 `Verified`。
3. 纯临时方案优先标记为 `Mitigated` 或 `Known Debt`，避免误判为已完成。
4. 与当前阶段范围直接相关的问题，需同步更新 [chat-system-practices.md](./chat-system-practices.md) 的完成度描述。
