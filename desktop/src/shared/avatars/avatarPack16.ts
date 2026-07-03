import { getApiBaseUrl } from "@/shared/platform/desktopRuntime";

export interface BuiltinAvatarOption {
  id: string;
  label: string;
  src: string;
  description: string;
  tags: string[];
}

type BuiltinAvatarManifestEntry = Omit<BuiltinAvatarOption, "src"> & {
  fileName: string;
};

const avatarPack16Manifest: BuiltinAvatarManifestEntry[] = [
  {
    id: "formal-reviewer",
    label: "Formal Reviewer",
    fileName: "01_formal_reviewer_128.png",
    description: "结论先行，措辞克制，像一位把边界讲清楚的审稿人。",
    tags: ["评审", "结构化", "正式"],
  },
  {
    id: "pilot-helper",
    label: "Pilot Helper",
    fileName: "02_pilot_helper_128.png",
    description: "会陪你把混乱任务排成顺序，也会在关键处轻推一把。",
    tags: ["协作", "拆解", "陪伴"],
  },
  {
    id: "archive-guide",
    label: "Archive Guide",
    fileName: "03_archive_guide_128.png",
    description: "像熟悉馆藏脉络的整理者，能把资料安静地归回它该在的位置。",
    tags: ["归档", "知识库", "整理"],
  },
  {
    id: "research-analyst",
    label: "Research Analyst",
    fileName: "04_research_analyst_128.png",
    description: "习惯先找证据再说判断，像总能把论点钉牢的研究同事。",
    tags: ["研究", "分析", "证据"],
  },
  {
    id: "story-crafter",
    label: "Story Crafter",
    fileName: "05_story_crafter_128.png",
    description: "脑子里总有第二种讲法，能把想法写得更有画面和节奏。",
    tags: ["创意", "文案", "策划"],
  },
  {
    id: "logic-tutor",
    label: "Logic Tutor",
    fileName: "06_logic_tutor_128.png",
    description: "讲复杂问题时不着急，像会一层层拆开推理链的老师。",
    tags: ["教学", "推理", "讲解"],
  },
  {
    id: "support-companion",
    label: "Support Companion",
    fileName: "07_support_companion_128.png",
    description: "说话有分寸也有温度，像在你旁边稳稳接住情绪的人。",
    tags: ["陪伴", "安抚", "支持"],
  },
  {
    id: "security-sentinel",
    label: "Security Sentinel",
    fileName: "08_security_sentinel_128.png",
    description: "对规则和风险很敏锐，像永远先看清红线再继续的人。",
    tags: ["安全", "规则", "合规"],
  },
  {
    id: "vision-planner",
    label: "Vision Planner",
    fileName: "09_vision_planner_128.png",
    description: "喜欢把眼前动作放回长期路线里，像会替团队看三步以后的人。",
    tags: ["规划", "路线图", "产品"],
  },
  {
    id: "code-artisan",
    label: "Code Artisan",
    fileName: "10_code_artisan_128.png",
    description: "像写过很多年代码的人，耐心、讲究，还会顺手把细节抛光。",
    tags: ["编程", "调试", "工程"],
  },
  {
    id: "debate-counsel",
    label: "Debate Counsel",
    fileName: "11_debate_counsel_128.png",
    description: "不急着站队，先把正反两边摆平，像很会控场的讨论搭子。",
    tags: ["辩证", "论证", "平衡"],
  },
  {
    id: "data-navigator",
    label: "Data Navigator",
    fileName: "12_data_navigator_128.png",
    description: "看数字时很清醒，像能从表格里一眼认出趋势和异动的人。",
    tags: ["数据", "指标", "报表"],
  },
  {
    id: "library-mentor",
    label: "Library Mentor",
    fileName: "13_library_mentor_128.png",
    description: "有点老派的耐心，会把知识脉络讲得清楚又不卖弄。",
    tags: ["阅读", "学习", "知识"],
  },
  {
    id: "spark-intern",
    label: "Spark Intern",
    fileName: "14_spark_intern_128.png",
    description: "新鲜感很多，动作也轻快，像随时能递来一个新点子的年轻同伴。",
    tags: ["灵感", "探索", "轻量"],
  },
  {
    id: "blue-poet",
    label: "Blue Poet",
    fileName: "15_blue_poet_128.png",
    description: "对语气和留白很敏感，像总能把句子磨得更顺更有余味的人。",
    tags: ["文艺", "润色", "语气"],
  },
  {
    id: "orchid-strategist",
    label: "Orchid Strategist",
    fileName: "16_orchid_strategist_128.png",
    description: "思考总带一点纵深，像习惯先看局势再决定落子的战略顾问。",
    tags: ["战略", "判断", "高阶"],
  },
];

export const BUILTIN_AVATAR_PACK_16_PREFIX = "/assets/avatars/avatar-pack-16";

export function getBuiltinAvatarPack16Url(fileName: string) {
  return `${getApiBaseUrl()}${BUILTIN_AVATAR_PACK_16_PREFIX}/${fileName}`;
}

export function getBuiltinAvatarPack16Options(): BuiltinAvatarOption[] {
  return avatarPack16Manifest.map((entry) => ({
    ...entry,
    src: getBuiltinAvatarPack16Url(entry.fileName),
  }));
}

export { avatarPack16Manifest };
