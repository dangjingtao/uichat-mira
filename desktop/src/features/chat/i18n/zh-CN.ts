const chatPending = {
  chat: {
    sidebar: {
      newConversation: "+ 新建对话",
      untitledConversation: "新对话",
      archive: "归档",
      delete: "删除",
    },
    page: {
      statusUnknown: "检测中",
      statusRunning: "运行中",
      statusStopped: "未启动",
      welcomeMessage: "你好，我是 UI Chat RAG 助手。请输入你的问题。",
      suggestion1: "帮我总结今天的任务重点",
      suggestion2: "给我一个 RAG 系统排障清单",
      suggestion3: "设计一个接口联调计划",
      inputPlaceholder: "输入问题，回车发送...",
    },
    ragDrawer: {
      copyJson: "复制 JSON",
      closeDetail: "关闭执行过程详情",
      copySuccess: "JSON 已复制",
      copyFailed: "复制失败，请重试",
    },
    executionTrace: {
      title: "RAG 过程",
      stepCount: "{{completed}} / {{total}} 步",
      status: {
        running: "进行中",
        completed: "已完成",
        failed: "异常",
      },
    },
    threadProvider: {
      defaultTitle: "新对话",
    },
    provider: {
      placeholderReply: "（你还没接入后端；先占位）",
    },
    adapter: {
      listFailed: "获取对话列表失败: {{error}}",
      renameFailed: "重命名对话失败: {{error}}",
      archiveFailed: "归档对话失败: {{error}}",
      unarchiveFailed: "取消归档对话失败: {{error}}",
      deleteFailed: "删除对话失败: {{error}}",
      createFailed: "创建对话失败: {{error}}",
      fetchFailed: "获取对话详情失败: {{error}}",
      saveMessageFailed: "保存消息失败: {{error}}",
      unknownError: "未知错误",
    },
    parsers: {
      unnamedNode: "未命名节点",
      doubleHit: "双重命中",
      keywordHit: "关键词命中",
      semanticHit: "语义命中",
      knowledgeBaseHit: "知识库命中",
      rewriteLabel: "整理检索问题",
      rewriteSummary: "正在将问题改写成更适合检索的表达",
      embedLabel: "生成语义向量",
      embedSummary: "正在准备语义检索所需的查询向量",
      retrieveLabel: "召回候选片段",
      retrieveSummary: "正在从知识库中筛出相关内容",
      rerankLabel: "整理结果优先级",
      rerankSummary: "正在对候选片段做进一步排序",
      generateLabel: "组织最终回答",
      generateSummary: "正在结合来源生成最终回复",
      inProgress: "{{label}}中",
      failed: "{{label}}失败",
      completed: "已完成回答组织",
    },
    title: {
      default: "新对话",
    },
    localModel: {
      replyPrefix: "已收到：{{prompt}}",
      replySuffix:
        "这是 uchat 本地演示回复。你可以继续输入问题，后续可直接替换为真实后端推理接口。",
      greeting: "你好，我是你的 RAG 助手。请告诉我你想查询的内容。",
    },
  },
} as const;

export default chatPending;
