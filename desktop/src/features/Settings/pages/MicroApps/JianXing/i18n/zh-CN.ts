const jianXingZh = {
  settings: {
    microApps: {
      jianXing: {
        page: { miniTitle: "触界", title: "触界", description: "连接当前 Chrome，在本机使用见行操作网页，或通过剪藏采集内容。", guide: "使用指南" },
        guide: {
          close: "关闭使用指南", footerClose: "关闭", title: "触界使用指南", intro: "完成扩展、Native 和授权配置后，连接状态会自动同步到这里。",
          extensionTitle: "安装触界扩展", extensionBody: "下载并在 Chrome 扩展管理页安装、启用触界。开发调试时加载项目的扩展根目录，不加载内部的 extension 子目录。",
          nativeTitle: "注册 Native Messaging", nativeBody: "在本页点击“安装 Native”或“修复 Native”。“Native 已安装”只代表 Chrome 可以找到本机连接组件，不代表扩展已经在线。",
          authTitle: "完成扩展授权", authBody: "点击“浏览器扩展授权”生成一次性授权码，在 Chrome 的触界侧栏粘贴并授权。扩展授权后会主动连接 Native Messaging 和 Mira。",
          connectionTitle: "确认连接状态", connectionBody: "“等待扩展”表示 Mira 已就绪，正在等待 Chrome 扩展接入；只有显示“扩展已连接”后，见行和剪藏规则同步才可使用。",
          usageTitle: "使用见行与剪藏", usageBody: "见行先用“看”读取页面和元素引用，再执行翻页、点击、填写或传输。剪藏用于用户主动采集；网站规则只影响对应网站的正文和图片提取。",
        },
        tabs: { jianxing: "见行", clipper: "剪藏", expert: "问策" },
        modes: { look: "看", browse: "翻", act: "点", transfer: "传", lookDescription: "读取当前页面状态和稳定元素引用", browseDescription: "打开、返回、刷新、滚动和等待", actDescription: "点击、填写、选择和发送按键", transferDescription: "上传文件或获取下载结果" },
        actions: { snapshot: "页面快照", page: "页面信息", tabs: "标签页列表", element: "元素详情", screenshot: "页面截图", open: "当前页打开网址", new: "新开标签页", switch: "切换标签页", close: "关闭标签页", back: "后退", forward: "前进", reload: "刷新", scroll: "滚动", scrollTo: "滚动到元素", paginate: "翻页", wait: "等待", click: "点击", hover: "悬停", drag: "拖拽", fill: "填写", select: "选择", press: "按键", dialog: "处理弹窗", upload: "上传文件", download: "获取下载" },
        connection: { chrome: "Chrome 连接", extensionConnected: "扩展已连接", waitingExtension: "等待扩展", disconnected: "未连接", download: "下载插件", downloading: "下载中…", authorize: "浏览器扩展授权", disconnect: "断开", connect: "连接", supportedRegion: "支持区域点选", unsupportedRegion: "未报告区域点选", unknown: "未知", nativeInstall: "安装 Native", nativeInstalling: "安装中…", nativeCheck: "正在检查…", nativeUnavailable: "Native 不可用", nativeRepair: "修复 Native", nativeInstalled: "Native 已安装", nativeNeedsRepair: "Native 需修复", nativeNotInstalled: "Native 未安装", unregister: "解除注册", local: "本机", extensionVersion: "扩展 v{{version}}" },
        operation: { started: "正在操作 Chrome：{{operation}}", browserPage: "浏览器页面", failed: "操作失败", completed: "已完成", error: "操作失败", status: "见行浏览器状态" },
        fields: { parameters: "参数", parametersHint: "先读取页面，再使用快照中的稳定引用执行操作。", operation: "操作方式", ref: "元素引用 ref", refPlaceholder: "例如 e17", file: "文件", filePlaceholder: "请选择一个文件", url: "网址", scrollAmount: "滚动距离（px）", waitTime: "等待时间（ms）", dragRefs: "起点 ref, 终点 ref", downloadUrl: "下载地址", value: "参数值", valuePlaceholder: "填写参数", sendViaNative: "请求将在本机 Native Messaging 通道中发送", authorizeFirst: "请在 Chrome 中完成触界扩展授权，连接后才能发送请求", run: "执行中…", observe: "观察页面", send: "发送操作", browserOnly: "见行浏览器状态" },
        result: { title: "页面结果", clear: "清空", currentConnection: "当前连接", noResult: "还没有页面结果", localOnly: "结果仅通过本机连接通道传递", screenshot: "页面截图" },
        clipper: { title: "URL 剪藏规则", help: "按完整 URL 的通配符或正则匹配；多个规则同时命中时使用约束最具体的一条。", refresh: "刷新规则", refreshing: "刷新中…", add: "新增规则", refreshFailed: "规则刷新失败", status: "规则状态", empty: "暂无 URL 剪藏规则" },
        auth: { title: "浏览器扩展授权", close: "关闭", intro: "生成一次性授权码后，触界扩展会自动打开授权页；如果 Chrome 没有切到授权页，点击工具栏中的触界图标即可进入。", generate: "生成授权码", generating: "生成中...", copy: "复制", open: "打开授权页", expiry: "授权码 5 分钟内有效且只能使用一次。生成后切到 Chrome 的触界授权页，粘贴并点击“授权并连接”；授权成功后扩展会自动连接 Mira，无需再手动点击连接。" },
        messages: { openAuthFailed: "无法打开触界授权页，请重新加载扩展", nativeReadFailed: "无法读取 Native Messaging 状态", connectExtension: "请先连接触界扩展", rulesLoaded: "URL 剪藏规则已从触界扩展加载", rulesReadFailed: "无法读取 URL 剪藏规则", regionIncludePrompt: "请在 Chrome 中点击正文区域", regionExcludePrompt: "请在 Chrome 中点击要排除的区域", regionIncluded: "已选择当前页面的正文区域", regionExcluded: "已添加当前页面的排除区域", regionFailed: "区域选择失败", urlRequired: "请输入 URL 通配符或正则", invalidRegex: "URL 正则格式无效，请检查括号、反斜杠和量词", rulesSaved: "URL 剪藏规则已保存到触界扩展", rulesSaveFailed: "保存 URL 剪藏规则失败", ruleNotSaved: "当前 URL 规则尚未保存", rulesDeleted: "URL 剪藏规则已删除", rulesDeleteFailed: "删除 URL 剪藏规则失败", connectFailed: "无法连接触界服务", browserFailed: "浏览器操作失败", codeGenerated: "授权码已生成，5 分钟内有效且只能使用一次", codeGenerateFailed: "生成授权码失败", codeCopied: "授权码已复制", extensionDownloaded: "Mira Clipper 已下载到系统下载目录", extensionDownloadFailed: "插件下载失败", nativeInstalled: "Native Messaging 连接组件已安装", nativeNeedsRepair: "Native Messaging 安装后仍需修复", nativeInstallFailed: "Native Messaging 安装失败", nativeUnregistered: "Native Messaging 已解除注册", nativeUnregisterFailed: "Native Messaging 解除注册失败" },
        rules: { alias: "别名", unnamed: "未命名", urlPattern: "网址匹配", regex: "正则", wildcard: "通配", content: "正文", selected: "已点选 · {{tag}}", configured: "已配置区域", defaultExtract: "默认提取", images: "图片", imageCount: "{{count}} 张", enabled: "已启用", disabled: "已停用", status: "状态", actions: "操作", edit: "编辑规则", editAria: "编辑 {{name}} 规则" },
        rulesDrawer: { close: "关闭规则编辑", editTitle: "编辑 URL 剪藏规则", addTitle: "新增 URL 剪藏规则", description: "配置 URL 匹配、网页正文、排除区域和图片提取条件", delete: "删除规则", saving: "保存中…", save: "保存 URL 规则", syncFailed: "规则同步失败", status: "规则状态", alias: "网站别名（可选）", aliasPlaceholder: "例如 产品帮助中心", urlPattern: "URL 匹配规则", regexPlaceholder: "例如 ^https://example\\.com/article/.*", wildcardPlaceholder: "例如 https://example.com/article/*", matchMode: "匹配方式", wildcard: "通配符", regex: "正则", matchHelp: "必填。通配符中 `*` 匹配任意长度文本，`?` 匹配一个字符；正则模式填写 JavaScript 正则表达式，不填写标志。多个规则命中同一页面时，扩展使用约束最具体的一条。", enabled: "启用当前规则", disabledHint: "停用后当前 URL 范围回到默认提取", enabledAria: "启用当前 URL 规则", includeRegion: "正文区域", picking: "等待点选…", reselect: "重新选择", selectInclude: "选择正文区域", noPreview: "所选区域没有可预览文字", legacyRegion: "此规则来自旧版配置，请重新点选正文区域以生成可读摘要。", emptyInclude: "尚未选择，保存后该网站仍使用默认正文判断。", excludeRegion: "排除区域", addExclude: "添加排除区域", excludeItem: "排除区域 {{index}} · {{tag}}", webRegion: "网页区域", selectedRegion: "已选择网页区域", deleteExclude: "删除排除区域 {{index}}", noExclude: "没有排除区域", minWidth: "图片最小宽度", minHeight: "图片最小高度", maxCount: "图片数量上限" },
      },
      studioEntries: { jianXing: { title: "触界", description: "连接当前 Chrome，在本机查看页面、翻页、点击、填写和处理文件操作。", actions: { open: "进入触界" } } },
    },
  },
} as const;

export default jianXingZh;
