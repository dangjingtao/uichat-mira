const dashboard = {
  dashboard: {
    home: {
      welcomeBack: "欢迎回来，{{username}}",
      startTest: "开始测试",
      logout: "退出登录",
      backendService: "后端服务",
      databaseConnection: "数据库连接",
      runtime: "运行环境",
      subtitle: "系统状态正常后，直接进入对话测试、知识检索和结果复盘。",
      currentUser: "当前账户",
      userHint: "保持页面简洁，主要任务从聊天工作区开始。",
      quickStartLabel: "快速开始",
      quickStartHint: "首页只负责确认状态和进入主流程。",
      openWorkspace: "进入聊天工作区",
    },
  },
} as const;

export default dashboard;
