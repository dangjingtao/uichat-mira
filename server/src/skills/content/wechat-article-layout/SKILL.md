---
id: wechat-article-layout
displayName: 微信公众号文章排版
description: "把 URL、Markdown 文件或正文排版成微信公众号编辑器可直接粘贴的 HTML。内置 terminal-dark、minimal-light、magazine-warm、academic-blue 四套风格；当用户要求公众号排版、公众号发布稿、可粘贴 HTML 或给出文章链接要求排版时使用。未指定风格时必须先追问一次。"
version: 0.1.0
category: content
visibility: public
source: Mira
status: review
execution.context: fork
execution.agent: subAgent
execution.allowedTools: read_open, terminal_session
execution.workspaceBound: true
---

# 微信公众号文章排版

把文章转成微信公众号编辑器可直接粘贴的 HTML。核心资产：

- `skill://wechat-article-layout/scripts/build_wechat_html.py`
- `skill://wechat-article-layout/references/dark-mode-mapping.md`

这个 Skill 使用现有 `terminal_session` 执行脚本，不注册专用 Runtime，不安装依赖，不绕过 Harness、审批、工作区和 Evidence。

## 0. 风格确认：唯一必问项

没有明确风格时，不得直接生成。返回 `needs_input`，只提出一项 `user_input` requirement：

> 请选择排版风格：terminal-dark 终端暗黑、minimal-light 清爽简约、magazine-warm 杂志暖调、academic-blue 学术规整。

用户已经点名风格、中文别名或明确说“沿用上次风格”时，视为已确认，不重复询问。收到用户回答后继续原排版任务，不把“magazine-warm”之类的短回答当成新任务。

## 1. 输入准备

支持：

- 本轮聊天上传的 `.md` / `.txt` 等文件；
- 工作区内已有的 `.md` / `.txt` 文件；
- 用户直接粘贴的正文；
- URL。

处理规则：

1. 本轮上传附件：Agent 会在目标中提供工作区相对路径，直接读取该路径；不要要求用户再手工复制到工作目录。
2. 工作区已有文件：优先按用户明确提供的路径读取，不复制、不改用上传附件。
3. 粘贴正文：忠实写入工作区临时 Markdown，不改写原文。
4. URL：可用 `terminal_session` 调用系统已有 `curl` 下载；抓取失败就如实返回缺口，不安装抓取器。
5. 标题和来源可以从用户输入推断；缺失时允许留空，不额外追问。

生成器支持：段落、分隔线、引用块、三级标题、加粗、行内代码、无序/有序列表、独立行图片。Markdown 链接按公众号不可依赖链接处理，降级为“标题（地址）”。

## 2. 执行生成器

先用 `skill_read_resource` 读取脚本全文，再使用当前主机 shell 的原生 UTF-8 文件写入方式，把脚本原样落到工作区：

```text
.mira/staging/wechat-article-layout/build_wechat_html.py
```

不得改写脚本视觉预设。仅当输入触发确定的健壮性问题时，才修改脚本并保留原主流程。

解释器规则：

1. 先使用当前环境已存在的 `python`；Windows 可回退到 `py -3`。
2. 不执行 `pip install`、`conda install`、虚拟环境创建或全局 Python 配置。
3. 脚本只依赖 Python 标准库：`argparse`、`os`、`re`。
4. 当前环境没有 Python 时，返回 capability 缺口，不擅自安装。

调用形式：

```text
python build_wechat_html.py --input <article.md> --output <article-wechat.html> --style <style> --title <title> --source <source>
```

路径必须位于当前工作区。`terminal_session` 的调用继续走正常精确审批。

## 3. 图片处理

生成器会把 Markdown 图片替换成轻量占位行，并在执行结果 `images` 中返回原始地址和 alt。

存在图片时：

1. 用系统已有 `curl` 下载到输出文件旁的 `images/`；
2. 检查文件非空，并用文件头或系统文件识别能力确认不是 HTML 错误页；
3. 下载失败不阻断正文 HTML，但必须在交付中列出失败图片；
4. 告诉用户在占位行处上传对应图片，再删除占位行。

不得引入 Pillow、requests 或其他 Python 第三方依赖。

## 4. 最低验证

生成后至少完成：

1. HTML 文件存在且非空；
2. 标题和正文关键文本存在；
3. 不包含 `<script>`；
4. 图片占位数量与 `images` 结果一致；
5. 输入中标题、引用、列表即使没有规范空行，也没有互相吞并。

当前环境已有 Chrome/Chromium 时，可以额外截图检查；没有浏览器时不安装，只报告未做视觉截图验证。

## 5. 交付

交付内容只包括：

- 生成的 HTML；
- 成功下载的图片文件；
- 失败图片清单（如有）；
- 粘贴步骤：浏览器打开 HTML → `Ctrl+A` → `Ctrl+C` → 公众号编辑器 `Ctrl+V`；
- 提醒标题、作者、封面在公众号后台单独填写。

完成必须有真实 Artifact / 文件 Evidence。仅输出一段 HTML 文本或口头声称“已生成”不算完成。

## 深色模式

需要判断或调整配色时，再读取：

`skill://wechat-article-layout/references/dark-mode-mapping.md`

不要默认加载，也不要为了普通排版重新做色卡研究。

## 抗剥离红线

1. 只使用 `section / p / span / strong / img`，不用 `div / h1-h6 / blockquote`。
2. 最外层使用无样式空 `section` 作为牺牲层。
3. 背景色写到各元素，不依赖继承。
4. 纵向间距使用 padding，不依赖 margin。
5. 左右内距下沉到顶层元素。
6. 保留负 margin 出血骨架。
7. 装饰性圆角允许被微信降级。
8. 首尾背景间隔条不得删除。
