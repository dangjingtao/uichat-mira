const codeGraphZh = {
  settings: {
    microApps: {
      studioEntries: {
        codeGraph: {
          title: "CodeGraph Studio",
          description:
            "管理代码仓索引、运行时状态和智能体代码理解能力。真实 CodeGraph 可直接启动并由 Mira 受控调用。",
          actions: {
            open: "进入 CodeGraph",
          },
        },
      },
      codeGraphStudio: {
        overview: {
          description:
            "真实 CodeGraph 已接入 Managed Runtime。首次启动会初始化并建立当前工作区索引，后续复用本地索引并由 CodeGraph 自动同步变更。",
          nextSteps: {
            step1: {
              title: "确认 App Data Root",
              description: "日志和 Mira 管理数据放在仓库外部目录。",
            },
            step2: {
              title: "启动 CodeGraph",
              description: "Mira 会检查 Provider、Telemetry，并在需要时初始化工作区索引。",
            },
            step3: {
              title: "允许智能体使用",
              description: "开启后，Planner 只会看到受控的 codebase_explore，不会暴露 CodeGraph 原生命令。",
            },
          },
        },
        blockedCards: {
          externalIndex: {
            title: "工作区本地索引",
            description:
              "当前 CodeGraph 使用 workspace/.codegraph 保存项目索引。这是已声明的 Runtime 数据，不再作为启动阻断。",
            badge: "已接受",
          },
          pollutionGuard: {
            title: "Repo-local Runtime Data",
            description:
              "Mira 会保留并复用 workspace/.codegraph，不自动删除用户数据；其他 Provider 仍保持严格边界。",
            badge: "受控",
          },
        },
        cards: {
          pollutionSummary: {
            title: "本地索引摘要",
            behavior: "受控使用 workspace/.codegraph，不自动删除",
            noticeTitle: "这是 CodeGraph 的项目索引，不是启动错误。",
            noticeBody:
              "真实 CodeGraph 当前需要 workspace/.codegraph。Mira 会把它作为声明过的 Runtime 数据使用，并继续把日志等管理数据放在 App Data Root。",
          },
          capability: {
            agentCapabilityHint:
              "允许智能体使用 CodeGraph。Runtime ready、Telemetry 关闭、Workspace 匹配且 App Data Root 合法后，Harness 会注册唯一受控工具 codebase_explore。",
            unavailable:
              "当前还不能注册 codebase_explore，请检查 Provider、Telemetry、Workspace 和 App Data Root。",
          },
          actions: {
            title: "CodeGraph Runtime",
            description:
              "启动会自动检查 Provider，并在工作区尚未初始化时建立索引；Stop 只停止运行时，不删除索引。",
            startHintBlocked:
              "当前存在真正的启动阻断，请检查 Provider、Telemetry 或 App Data Root。",
            startHintFake:
              "当前使用 Fake Provider，仅用于开发验证。切回真实 Provider 后可启动实际 CodeGraph。",
          },
          smoke: {
            description:
              "Smoke 会走真实 Managed Runtime、CodeGraph 查询和原文 verification，用来确认 Agent 能力链是否真正可用。",
            realReady: "真实 Provider 已 ready，可以执行受控 Smoke。",
            realBlocked: "真实 Provider 尚未 ready，请先启动或检查运行时。",
            realDisabledHint: "Runtime 未 ready，Smoke 暂不可执行。",
          },
          smokeResult: {
            description:
              "这里显示真实 Runtime 与受控查询结果；verified candidate 才能证明代码证据链有效。",
          },
        },
        actions: {
          detect: "检测 Provider",
          start: "启动 CodeGraph",
          health: "检查状态",
          stop: "停止 CodeGraph",
          smokeStatus: "验证 Runtime",
          smokeQuery: "验证代码查询",
        },
        states: {
          emptySmoke:
            "还没有 Smoke 结果。启动 CodeGraph 后可以验证 Runtime 和代码查询链。",
        },
      },
    },
  },
} as const;

export default codeGraphZh;
