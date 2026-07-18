const codeGraphZh = {
  settings: {
    microApps: {
      studioEntries: {
        codeGraph: {
          title: "CodeGraph",
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
            "真实 CodeGraph 已接入 Managed Runtime。首次使用会为当前 Agent 工作区按需初始化索引，后续复用本地索引并由 CodeGraph 自动同步变更。",
          nextSteps: {
            step1: {
              title: "确认 App Data Root",
              description: "日志和 Mira 管理数据放在仓库外部目录。",
            },
            step2: {
              title: "启用 CodeGraph",
              description: "一个开关同时启用微应用和受控智能体能力，无需额外权限开关。",
            },
            step3: {
              title: "直接用于智能体",
              description:
                "启用后，Planner 自动获得唯一受控工具 codebase_explore；CodeGraph 原生命令仍保持内部封装。",
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
          blockedReasons: {
            emptyTitle: "当前没有阻断原因",
            emptyDescription: "当前状态未检测到会阻止 CodeGraph 运行的条件。",
          },
          pollutionSummary: {
            title: "本地索引摘要",
            behavior: "受控使用 workspace/.codegraph，不自动删除",
            noticeTitle: "这是 CodeGraph 的项目索引，不是启动错误。",
            noticeBody:
              "真实 CodeGraph 当前需要 workspace/.codegraph。Mira 会把它作为声明过的 Runtime 数据使用，并继续把日志等管理数据放在 App Data Root。",
          },
          capability: {
            microAppHint:
              "开启后，CodeGraph 微应用和智能体 codebase_explore 一起启用；关闭时一起停用。无需第二个权限开关。",
            agentCapabilityHint:
              "兼容字段会跟随“启用 CodeGraph 微应用”，不再作为独立权限开关。",
            unavailable:
              "当前还不能注册 codebase_explore，请检查 Provider 和 App Data Root。Runtime 会在具体 Agent 工作区首次使用时按需启动。",
          },
          actions: {
            title: "CodeGraph Runtime",
            description:
              "这里用于手动检测和调试 Runtime。Agent 正常使用不要求你先点击 Start；启用微应用后会按工作区懒启动。Stop 只停止运行时，不删除索引。",
            startHintBlocked:
              "当前存在真正的启动阻断，请检查 Provider 或 App Data Root。",
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
            "还没有 Smoke 结果。需要手动验证时可以启动 CodeGraph，再检查 Runtime 和代码查询链。",
        },
      },
    },
  },
} as const;

export default codeGraphZh;
