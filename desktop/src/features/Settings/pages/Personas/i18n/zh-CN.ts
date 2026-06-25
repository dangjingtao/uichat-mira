const roleTranslations = {
  page: {
    title: "角色",
    description: "把角色做成提示词工程工作台。",
  },
  actions: {
    new: "新建角色",
    import: "导入角色",
    delete: "删除角色",
    preview: "预览",
    guide: "字段说明",
    editContent: "编辑内容",
    copySuffix: "副本",
  },
  editor: {
    title: "编辑角色",
    hint: "调整角色定义与提示词结构。",
  },
  list: {
    title: "角色列表",
    hint: "这里保存的是可复用的提示词原型。",
    empty: "当前还没有角色，先新建一个。",
  },
  fields: {
    title: "核心字段",
    hint: "每个字段单独进入抽屉编辑，主界面只保留概览。",
    empty: "尚未填写",
  },
  llmProfile: {
    title: "模型参数",
    empty: "未设置专属生成参数，将沿用当前聊天配置。",
    configuredCount: "已配置 {{count}} 项",
    drawer: {
      title: "角色模型参数",
      hint: "为当前角色设置独立的生成参数。未填写的字段将继续沿用聊天侧默认值。",
      note: "这些参数只影响当前角色发起的回复，不会改动其他角色或全局聊天设置。",
      close: "关闭模型参数抽屉",
      closeMask: "关闭角色模型参数",
    },
    messages: {
      saved: "角色模型参数已保存",
      saveFailed: "保存角色模型参数失败",
    },
    fields: {
      temperature: {
        label: "温度",
        placeholder: "例如 0.7",
        tooltip: "控制回复的发散程度。值越低越稳，值越高越灵活。",
      },
      topP: {
        label: "Top P",
        placeholder: "例如 0.9",
        tooltip: "控制采样概率范围。数值越小，模型越偏向高置信候选。",
      },
      topK: {
        label: "Top K",
        placeholder: "例如 40",
        tooltip: "限制每一步可选词的数量。数值越小，输出越集中。",
      },
      maxTokens: {
        label: "最大输出",
        placeholder: "例如 1024",
        tooltip: "限制单次回复的最大生成长度，用于控制篇幅和成本。",
      },
      frequencyPenalty: {
        label: "重复惩罚",
        placeholder: "例如 0.3",
        tooltip: "降低重复词句再次出现的概率，适合压制啰嗦表达。",
      },
      presencePenalty: {
        label: "新意偏好",
        placeholder: "例如 0.2",
        tooltip: "提高引入新词和新角度的倾向，适合鼓励内容展开。",
      },
    },
  },
  status: {
    published: "正式",
    draft: "草稿",
  },
  header: {
    previewOnly: "提示词原型",
  },
  form: {
    name: "名称",
    summary: "简介",
    tags: "标签",
    tagsHelp: "最多 3 个标签，用于筛选和快速识别。",
    tagsPlaceholder: "输入后按回车添加",
    description: "角色描述",
    descriptionHelp: "定义角色是谁、做什么、从哪来。",
    worldview: "世界观",
    worldviewHelp: "定义角色对世界的基本理解。",
    persona: "人格核心",
    personaHelp: "定义角色身份与语气。",
    scenario: "适用场景",
    scenarioHelp: "定义使用场景。",
    exampleDialogues: "示例对话",
    exampleDialoguesHelp: "放入代表性的问答片段。",
    style: "表达风格",
    constraints: "约束规则",
    errors: {
      nameRequired: "角色名称不能为空。",
      nameTooLong: "角色名称不能超过 {{max}} 个字符。",
      summaryTooLong: "简介不能超过 {{max}} 个字符。",
    },
    coreContentEmpty:
      "角色描述、人格核心和适用场景都未填写，模型可能无法识别该角色。",
  },
  preview: {
    title: "提示词预览",
    hint: "查看角色与知识库上下文拼装后的结果。",
    chat: "普通聊天",
    rag: "RAG 聊天",
    testInput: "测试输入",
    stackTitle: "上下文堆栈",
    blockTitle: "提示词块预览",
    mode: "模式",
    persona: "角色",
    roleName: "角色名称",
    roleSummary: "角色简介",
    roleDescription: "角色描述",
    roleWorldview: "世界观",
    rolePersona: "人格核心",
    personaScenario: "适用场景",
    roleExamples: "示例对话",
    roleStyle: "表达风格",
    roleConstraints: "约束规则",
    input: "输入",
    systemPrompt: "系统提示词负责固定规则与安全边界。",
    knowledgeInjected: "知识库上下文会在生成前注入。",
    knowledgeSkipped: "当前仅预览角色本体，不注入知识库。",
    close: "关闭预览",
    closeMask: "关闭提示词预览",
    layers: {
      system: "系统层",
      role: "角色层",
      knowledge: "知识层",
      history: "历史层",
    },
    historyNotice: "历史消息会保留语境，但不会替代角色定义。",
    chatView: {
      hint: "这里展示的是角色在普通聊天中的预期回复形态。",
      replyIntro: "我会先按当前角色设定来理解你的问题。",
      replySummary: "当前角色给人的第一印象是：{{summary}}",
      replyScenario: "这次我会放在这个场景里回应：{{scenario}}",
      replyTask: "你现在想处理的是：{{input}}",
      replyPersona: "我的身份和态度会保持为：{{persona}}",
      replyStyle: "表达上我会尽量遵循：{{style}}",
      replyConstraint: "回答时我会优先遵守：{{constraints}}",
      replyClosing:
        "如果信息还不够，我会先给出稳妥判断，再说明还缺哪些关键条件。",
    },
  },
  prompt: {
    notice: "提示词块预览。",
  },
  guide: {
    name: {
      title: "名称",
      description: "一眼识别这个角色是谁。",
    },
    description: {
      title: "角色描述",
      description: "角色是谁、长什么样、做什么、从哪来。",
    },
    worldview: {
      title: "世界观",
      description: "角色对世界的基本理解与判断基底。",
    },
    persona: {
      title: "人格核心",
      description: "角色身份、气质和稳定行为方式。",
    },
    scenario: {
      title: "适用场景",
      description: "这个角色通常在什么情境里工作。",
    },
    exampleDialogues: {
      title: "示例对话",
      description: "让模型看见角色平时怎么接话。",
    },
    style: {
      title: "表达风格",
      description: "控制句长、语气和表达密度。",
    },
    constraints: {
      title: "约束规则",
      description: "限制不能越过的边界。",
    },
  },
  content: {
    title: "角色内容",
    hint: "在这里编排核心字段，主界面只保留名称和简介。",
    close: "关闭编辑",
    closeMask: "关闭角色内容",
  },
  fieldDrawer: {
    close: "关闭字段编辑",
    closeMask: "关闭字段编辑抽屉",
  },
  fieldHelp: {
    syntax: "推荐写法",
    good: "正面示例",
    bad: "反面示例",
  },
  fieldNotes: {
    description:
      "用于定义角色的身份、背景、外貌、职业以及在世界中的位置。用事实句而非修饰性散文来写，这是让角色在不同场景下仍然可识别的骨架。",
    worldview:
      "用于定义角色看待世界与问题的方法论。它不是人设装饰，而是后续判断、取舍和解释口径的底层依据。",
    persona:
      "用于定义角色身份、立场、关系感与稳定行为。这里决定角色是谁、通常怎么回应，而不是临时任务说明。",
    scenario:
      "用于限定角色最常出现的工作场景、任务空间与目标边界。它能帮助模型判断什么时候该主动、什么时候该收住。",
    exampleDialogues:
      "用于给出高价值示例，直接示范角色如何接话、推进、拒绝或澄清。示例应少而准，优先保留最能代表风格的轮次。",
    style:
      "用于约束表达层，包括句式、节奏、篇幅、信息密度与语气。它控制角色怎么说，而不是说什么事实。",
    constraints:
      "用于写清楚不能越过的边界、必须遵守的规则与冲突时的优先级。这里适合放硬约束，而不是重复人设描述。",
  },
  fieldExamples: {
    description: {
      syntax:
        "用事实句覆盖以下几类信息：\n- 身份或职业\n- 外貌或显著特征\n- 背景或世界观位置\n- 与 {{user}} 的关系",
      good: "艾琳是一名在边境城市工作的情报联络员，擅长收集消息和识别谎言。她穿着实用，习惯随身携带记录本，对陌生人保持距离，直到确认对方可靠。",
      bad: "你很厉害，很聪明，很有深度。\n你是一个很棒的角色。\n你现在帮我做这次汇报。",
    },
    worldview: {
      syntax:
        "可按这个顺序写：\n- 角色相信什么\n- 如何判断事实与风险\n- 面对冲突时优先保什么",
      good: "你相信判断必须建立在事实和证据上。\n面对争议时，你会先拆清前提，再给出结论。\n如果效率和准确性冲突，你优先保证结论可靠。",
      bad: "你很厉害，很聪明，很有深度。\n你三观很正。\n你现在帮我做这次汇报。",
    },
    persona: {
      syntax:
        "建议直接写三类信息：\n角色身份：...\n对 {{user}} 的态度：...\n稳定行为：...",
      good: "角色身份：你是一个严谨、克制、先给结论的产品评审助手。\n对 {{user}} 的态度：你保持专业合作，不刻意讨好，也不故作强硬。\n稳定行为：你通常先判断问题是否成立，再展开原因和建议。",
      bad: "你很温柔，很善良，很专业。\n你什么都会。\n你现在的任务是帮我把这篇文章改好。",
    },
    scenario: {
      syntax:
        "把它当成舞台说明来写：\n地点/环境：...\n角色关系：...\n当前局势：...\n目标或气氛：...",
      good: "地点/环境：团队正在评审一个准备上线的新功能。\n角色关系：{{user}} 是项目负责人，你负责指出风险和改进点。\n当前局势：方案信息不完整，但需要先给出方向判断。\n目标或气氛：对话保持专业、克制、以决策为导向。",
      bad: "你从小就生活在一个复杂的世界里。\n你是个很谨慎的人。\n最后你们成功发布并获得一致好评。",
    },
    exampleDialogues: {
      syntax:
        "直接写多轮短对话：\n{{user}}: ...\n{{char}}: ...\n\n每组只示范一种语气或动作。",
      good: "{{user}}: 这个方案能上吗？\n{{char}}: 能，但要先补齐异常路径和回滚方案。\n\n{{user}}: 为什么你先看风险？\n{{char}}: 因为上线后的代价通常比现在补一遍高。",
      bad: "角色会先分析，再给建议。\n这里应该体现专业感。\n以下是产品设计的一般原则：……",
    },
    style: {
      syntax:
        "聚焦表达层，不写事实内容：\n句长：...\n语气：...\n结构：...\n信息密度：...",
      good: "句长：以短句为主，必要时再补长句解释。\n语气：平静直接，不夸张，不撒娇。\n结构：先结论，再分点说明。\n信息密度：少废话，优先保留判断依据。",
      bad: "你是一个产品专家。\n你知道很多行业知识。\n你会帮助用户解决所有问题。",
    },
    constraints: {
      syntax:
        "用明确规则来写，最好能看出优先级：\n必须：...\n禁止：...\n冲突时优先：...",
      good: "必须：结论不能脱离用户给出的信息。\n禁止：不要编造未确认的事实或数据。\n冲突时优先：先保证准确，再追求表达完整。",
      bad: "尽量好一点。\n不要太奇怪。\n看情况回答。",
    },
  },
  messages: {
    created: "已创建新角色草稿",
    imported: "已导入角色副本",
    saved: "角色已保存",
    createFailed: "创建角色失败",
    saveFailed: "保存角色失败",
    loadFailed: "加载角色失败",
    deleted: "角色 {{name}} 已删除",
    reset: "已恢复当前角色状态",
    validationFailed: "请先修正表单错误再保存。",
  },
  deleteModal: {
    title: "删除角色",
    description: "将删除角色“{{name}}”。",
    confirm: "确认删除",
  },
  defaults: {
    newName: "未命名角色",
    newSummary: "用于从零开始编辑提示词结构。",
    newTag1: "草稿",
    newDescription: "角色的身份、背景和外貌尚未配置。",
    newTag2: "待配置",
    newWorldview: "你对世界的基本理解尚待配置。",
    newPersona: "你是一个待配置的角色。",
    newScenario: "适合从零编写角色提示词。",
    newExampleDialogues: "示例对话尚待填写。",
    newStyle: "保持简洁、可编辑、可复用。",
    newConstraints: "暂时不接入额外上下文。",
    previewInput: "帮我把这段内容整理成结论。",
  },
  presets: {
    formalReviewer: {
      name: "Formal Reviewer",
      summary: "适合评审、归纳和结构化输出。",
      tags: {
        strict: "严谨",
        concise: "先结论",
        structured: "结构化",
      },
      prompt: {
        description:
          "你是一个严谨、克制、擅长结构化分析、以证据为依据并优先给出结论的产品评审助手。",
        worldview: "你相信结论必须先于展开，事实应该先于修辞。",
        persona: "你是一个严谨、克制、先给结论的产品评审助手。",
        scenario: "适合评审、总结、分析和给出有依据的建议。",
        exampleDialogues:
          "用户：这方案能不能做？\n助手：能，但要先补齐边界与依赖。",
        style: "先结论后展开；语言短句为主；优先分点回答。",
        constraints: "不夸张，不空泛，不主动发散到无关话题。",
      },
    },
    pilotHelper: {
      name: "Pilot Helper",
      summary: "适合日常协作、任务分解和轻量陪伴。",
      tags: {
        collaborative: "协作",
        clear: "清楚",
        light: "轻快",
      },
      prompt: {
        description:
          "你是一个友好、清楚、愿意帮用户把复杂问题拆成可执行小步的协作助手。",
        worldview: "你相信复杂问题应该被拆成可执行的小步。",
        persona: "你是一个友好、清楚、愿意帮用户拆解任务的协作助手。",
        scenario: "适合日常问答、任务拆解、项目协作和待办整理。",
        exampleDialogues:
          "用户：我要开始做角色页。\n助手：先定字段，再定预览，再定保存路径。",
        style: "语气自然；必要时主动追问；给出可执行下一步。",
        constraints: "不抢答，不装懂，不制造过多形式感。",
      },
    },
    archiveGuide: {
      name: "Archive Guide",
      summary: "适合知识库浏览、材料整理和归档式表达。",
      tags: {
        archive: "档案",
        retrieval: "检索",
        order: "整理",
      },
      prompt: {
        description:
          "你是一个擅长整理资料、追溯来源并帮助用户浏览归档信息的知识助手。",
        worldview: "你相信信息的价值来自可追溯与可整理。",
        persona: "你是一个擅长整理资料、帮助用户回溯和归档的知识助手。",
        scenario: "适合知识整理、历史追踪、资料摘要和归档记录。",
        exampleDialogues:
          "用户：这份资料有什么重点？\n助手：我先给目录，再给摘要，再给来源。",
        style: "优先引用来源；措辞稳；更强调可追溯性。",
        constraints: "不要把整理结果写得像营销文案。",
      },
    },
  },
} as const;

export default roleTranslations;
