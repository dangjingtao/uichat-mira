import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  FileSearch,
  Headset,
  Megaphone,
  MonitorCog,
  Puzzle,
  Sparkles,
  UsersRound,
} from "lucide-react";

export type MicroAppTab = "discover" | "apps" | "templates" | "plugins";

export type HeroCard = {
  id: string;
  title: string;
  description: string;
  cta: string;
  tone: string;
};

export type Category = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export type MicroAppDetail = {
  id: string;
  name: string;
  slogan: string;
  summary: string;
  price: string;
  developer: string;
  categories: string[];
  updatedAt: string;
  publishedAt: string;
  gradient: string;
  icon: LucideIcon;
  gallery: Array<{
    id: string;
    title: string;
    tone: string;
    chart: "line" | "cards";
  }>;
  overview: string[];
  benefits: string[];
  capabilities: string[];
};

export const heroCards: HeroCard[] = [
  {
    id: "reporting",
    title: "轻松应对周报与复盘",
    description: "告别零散数据，多维表格协助你高效复盘。",
    cta: "立即探索",
    tone:
      "from-[#eef8ef] via-[#d9f4ea] to-[#b7ecf2] dark:from-[#1c2a29] dark:via-[#183331] dark:to-[#17303a]",
  },
  {
    id: "creator",
    title: "加入开发者计划",
    description: "首批入驻机会，获取流量分发与商业化支持。",
    cta: "了解详情",
    tone:
      "from-[#eef0ff] via-[#e5e8ff] to-[#d7def9] dark:from-[#20253a] dark:via-[#1d2740] dark:to-[#202941]",
  },
];

export const categories: Category[] = [
  { id: "data", label: "数据分析", icon: BarChart3 },
  { id: "ai", label: "AI 分析", icon: Sparkles },
  { id: "task", label: "任务管理", icon: ClipboardList },
  { id: "research", label: "问卷调研", icon: FileSearch },
  { id: "content", label: "内容运营", icon: Megaphone },
  { id: "event", label: "活动管理", icon: BriefcaseBusiness },
  { id: "hr", label: "人事管理", icon: UsersRound },
];

export const microApps: MicroAppDetail[] = [
  {
    id: "live-commerce",
    name: "电商直播管理",
    slogan: "助力电商团队管理直播计划、商品与主播资源，可实现直播全流程可视化与复盘",
    summary: "看板、排期、讲解节奏统一收口，适合直播团队日常协作。",
    price: "免费",
    developer: "多维表格",
    categories: ["贸易零售", "电商运营管理"],
    updatedAt: "2026/03/26 18:54:28",
    publishedAt: "2025/12/22 18:22:50",
    gradient:
      "from-[#ebe4ff] via-[#dcd7ff] to-[#c5ccff] dark:from-[#2d2643] dark:via-[#2a2949] dark:to-[#243049]",
    icon: MonitorCog,
    gallery: [
      {
        id: "trend",
        title: "直播业绩趋势\n一目了然",
        tone:
          "from-[#eee8ff] via-[#e8e2ff] to-[#ddd9ff] dark:from-[#28213c] dark:via-[#2a2442] dark:to-[#21253c]",
        chart: "line",
      },
      {
        id: "dashboard",
        title: "关键指标驾驶舱",
        tone:
          "from-[#efe8ff] via-[#ece5ff] to-[#e2dbff] dark:from-[#2a223d] dark:via-[#28243d] dark:to-[#23273e]",
        chart: "cards",
      },
    ],
    overview: [
      "一套面向电商直播业务的经营分析与管理模板，帮助团队全面掌握直播带货表现、商品动销情况与类目结构表现，实现数据驱动的直播经营决策。",
    ],
    benefits: [
      "直播经营核心指标一屏总览：GMV、佣金、利润、同比趋势清晰呈现。",
      "直播趋势洞察更直观：按月查看 GMV/佣金/利润趋势，快速识别增长点与异常波动。",
      "商品表现一目了然：商品列表展示价格、品类、标签、上架状态与详情信息。",
      "类目结构可视化：通过环形图直观看各类目占比与数量，帮助优化选品策略。",
      "业务场景覆盖更完整：支持样品管理、直播排期、直播分析、经营统计等多维任务协同。",
    ],
    capabilities: [
      "直播经营数据总览面板（GMV/佣金/利润 & 环比/同比趋势）",
      "月度直播业绩分析折线图",
      "主播、商品、场次多维经营看板",
      "类目分布与商品明细管理视图",
    ],
  },
  {
    id: "crm",
    name: "CRM",
    slogan: "让线索、客户、跟进动作和阶段目标都回到同一块业务面板里。",
    summary: "客户进展、跟进节点与线索分层都能放到一个工作视图里。",
    price: "免费",
    developer: "业务效率组",
    categories: ["客户管理", "销售协同"],
    updatedAt: "2026/04/18 09:42:10",
    publishedAt: "2026/01/11 10:15:36",
    gradient:
      "from-[#edf3ff] via-[#ddeaff] to-[#d5e4ff] dark:from-[#20293f] dark:via-[#1d2c44] dark:to-[#1f3248]",
    icon: Headset,
    gallery: [
      {
        id: "pipeline",
        title: "销售漏斗进展\n实时可见",
        tone:
          "from-[#ecf4ff] via-[#e4efff] to-[#dce8ff] dark:from-[#1f293f] dark:via-[#1f3047] dark:to-[#203447]",
        chart: "line",
      },
      {
        id: "followups",
        title: "跟进节奏统一协同",
        tone:
          "from-[#eff5ff] via-[#e5f0ff] to-[#dbe7ff] dark:from-[#21293f] dark:via-[#1f3046] dark:to-[#213648]",
        chart: "cards",
      },
    ],
    overview: [
      "把客户关系、销售节奏和协作记录收拢到一个团队工作台，帮助销售、运营和管理者看见同一份进展。",
    ],
    benefits: [
      "线索来源、负责人和当前阶段一处维护。",
      "跟进日志、待办提醒和关键时间节点自然串联。",
      "销售漏斗、成交节奏和团队节拍可以同步复盘。",
    ],
    capabilities: [
      "客户档案与阶段管理",
      "销售漏斗与阶段统计",
      "跟进计划和提醒视图",
      "团队成交节奏回顾面板",
    ],
  },
  {
    id: "device-management",
    name: "设备管理",
    slogan: "把设备台账、巡检、告警和维护记录统一到一套轻量运维工作流里。",
    summary: "设备台账、巡检状态和告警追踪集中展示，适合运维场景。",
    price: "免费",
    developer: "运营基础设施团队",
    categories: ["运维管理", "资产台账"],
    updatedAt: "2026/05/07 11:08:33",
    publishedAt: "2026/02/04 15:30:20",
    gradient:
      "from-[#fff0df] via-[#ffe5c8] to-[#f8d3af] dark:from-[#35281f] dark:via-[#3a2a1f] dark:to-[#3a2e21]",
    icon: Puzzle,
    gallery: [
      {
        id: "inspection",
        title: "巡检与告警\n集中看见",
        tone:
          "from-[#fff2e6] via-[#ffe9d3] to-[#f9dcbd] dark:from-[#37291f] dark:via-[#3a2e23] dark:to-[#382d22]",
        chart: "line",
      },
      {
        id: "assets",
        title: "资产状态统一归档",
        tone:
          "from-[#fff3e8] via-[#ffe9d4] to-[#f7dcc0] dark:from-[#352a21] dark:via-[#3a2f24] dark:to-[#3c3125]",
        chart: "cards",
      },
    ],
    overview: [
      "面向设备和资产场景的运维模板，用于维护设备台账、巡检记录、故障工单与维修节奏。",
    ],
    benefits: [
      "设备状态与巡检频率统一维护。",
      "告警、故障与维修责任链条更清楚。",
      "适合需要轻量资产运维协同的团队。",
    ],
    capabilities: [
      "设备台账列表",
      "巡检与异常记录",
      "维护工单追踪",
      "设备状态统计看板",
    ],
  },
];

export const findMicroAppById = (appId: string) =>
  microApps.find((app) => app.id === appId) ?? null;
