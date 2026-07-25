export type FertilitySignalStatus =
  | "favorable"
  | "neutral"
  | "mild_concern"
  | "moderate_concern"
  | "high_concern"
  | "unknown";

export type FertilityScoringCriterion = {
  id: string;
  label: string;
  role: "key" | "supporting";
  weight: number;
  anchors: string[];
};

export type FertilityScoringRule = {
  id: string;
  label: string;
  baseScore: number;
  criteria: FertilityScoringCriterion[];
  guardrails: string[];
};

export const FERTILITY_SCORING_VERSION = "fertility-rubric-v2.0.0";

export const FERTILITY_SCORE_BANDS = [
  { min: 8, id: "advantage", label: "优势维持" },
  { min: 6.5, id: "stable", label: "总体稳定" },
  { min: 5, id: "optimize", label: "建议优化" },
  { min: 3, id: "concern", label: "需要关注" },
  { min: 0, id: "priority", label: "优先评估" },
] as const;

export const FERTILITY_SCORING_RULES: Record<string, FertilityScoringRule> = {
  female_endometrium: {
    id: "female_endometrium",
    label: "子宫内膜与宫腔环境",
    baseScore: 6.2,
    guardrails: [
      "单次、未注明月经周期时点的内膜厚度不得单独形成高置信度结论。",
      "宫腔影像或宫腔镜所见优先于症状推测；不得把内膜厚度直接等同着床概率。",
    ],
    criteria: [
      {
        id: "cavity_findings",
        label: "宫腔结构与病变",
        role: "key",
        weight: 1.4,
        anchors: [
          "宫腔镜、超声或盐水灌注检查提示宫腔形态无明显异常：favorable",
          "明确息肉、黏膜下肌瘤、宫腔粘连或其他可能影响宫腔的病变：moderate_concern 或 high_concern",
          "仅凭未检查不得判定异常：unknown",
        ],
      },
      {
        id: "cycle_appropriate_endometrium",
        label: "周期相位下的内膜表现",
        role: "key",
        weight: 1.2,
        anchors: [
          "临床记录为周期相位适宜、连续监测增厚趋势合理：favorable",
          "重复记录为偏薄、发育不同步或医生明确提示容受性问题：moderate_concern",
          "单次厚度且周期日不明：unknown",
        ],
      },
      {
        id: "bleeding_pattern",
        label: "月经与异常出血",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "周期相对规律且无异常出血：favorable",
          "经间出血、经期明显延长、经量异常或反复淋漓：mild_concern 至 moderate_concern",
        ],
      },
      {
        id: "uterine_history",
        label: "子宫疾病与手术史",
        role: "supporting",
        weight: 0.9,
        anchors: [
          "无相关病史且近期影像正常：favorable",
          "腺肌症、影响宫腔的肌瘤、既往宫腔手术或感染史：mild_concern 至 high_concern，按明确程度分类",
        ],
      },
    ],
  },
  female_hormonal_balance: {
    id: "female_hormonal_balance",
    label: "激素平衡与排卵节律",
    baseScore: 6.2,
    guardrails: [
      "月经规律可支持排卵可能性，但不等同所有激素均正常。",
      "TSH 应按实验室参考区间和临床情境解释；备孕阶段 2.5–4.0 mIU/L 不应自动扣分。",
    ],
    criteria: [
      {
        id: "ovulatory_pattern",
        label: "月经周期与排卵线索",
        role: "key",
        weight: 1.4,
        anchors: [
          "周期 21–35 天且相对规律、无明显高雄表现：favorable",
          "周期明显不规则、闭经、稀发月经或明确无排卵：moderate_concern 至 high_concern",
        ],
      },
      {
        id: "thyroid_context",
        label: "甲状腺功能情境",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "TSH/FT4 在实验室参考范围且无症状：neutral 或 favorable",
          "明确甲状腺功能异常或控制不佳：moderate_concern 至 high_concern",
          "TSH 2.5–4.0 且其余无异常：neutral，不得自动判为风险",
        ],
      },
      {
        id: "prolactin_androgen",
        label: "泌乳素与雄激素相关线索",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "相关检查及症状无异常：favorable",
          "明确高泌乳素、临床高雄表现或医生诊断的内分泌异常：moderate_concern",
        ],
      },
      {
        id: "art_hormonal_response",
        label: "促排与激素反应史",
        role: "supporting",
        weight: 0.9,
        anchors: [
          "既往促排反应和卵泡发育与方案预期相符：favorable",
          "反复发育不同步、提前排卵或明显异常反应：moderate_concern",
        ],
      },
    ],
  },
  female_oocyte_context: {
    id: "female_oocyte_context",
    label: "卵子潜力与年龄背景",
    baseScore: 6.5,
    guardrails: [
      "这是年龄与既往卵母细胞/胚胎结局的背景评分，不是卵子质量检测，也不是怀孕概率。",
      "AMH/AFC 不得直接作为卵子质量分。",
    ],
    criteria: [
      {
        id: "age_context",
        label: "女性年龄时间窗口",
        role: "key",
        weight: 1.6,
        anchors: [
          "小于 35 岁：favorable",
          "35–37 岁：mild_concern",
          "38–40 岁：moderate_concern",
          "大于 40 岁：high_concern；仅表示时间窗口与非整倍体风险背景",
        ],
      },
      {
        id: "oocyte_embryo_outcomes",
        label: "既往取卵与胚胎学结果",
        role: "key",
        weight: 1.5,
        anchors: [
          "有成熟卵、正常受精、优质囊胚或整倍体胚胎等直接结果：favorable",
          "反复低成熟率、低受精率、停育或无可用胚胎：moderate_concern 至 high_concern",
        ],
      },
      {
        id: "pregnancy_loss_context",
        label: "妊娠与流产背景",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "既往足月分娩或近期成功妊娠可作为有利背景：favorable",
          "反复妊娠丢失只能作为需进一步评估的背景，不得直接归因卵子：mild_concern",
        ],
      },
      {
        id: "oxidative_context",
        label: "可能影响卵母细胞环境的生活方式",
        role: "supporting",
        weight: 0.5,
        anchors: [
          "无吸烟、规律作息、营养与代谢基本稳定：favorable",
          "吸烟、严重睡眠不足或明显代谢问题：mild_concern",
        ],
      },
    ],
  },
  female_ovarian_reserve: {
    id: "female_ovarian_reserve",
    label: "卵巢储备与促排反应",
    baseScore: 6.2,
    guardrails: [
      "AMH/AFC 主要预测可募集卵泡或取卵数量，不能单独预测自然受孕、卵子质量或活产。",
      "优先使用实验室、年龄和中心特异参考；极低 AMH 不得用于拒绝治疗。",
    ],
    criteria: [
      {
        id: "amh",
        label: "AMH",
        role: "key",
        weight: 1.2,
        anchors: [
          "按检测平台和年龄背景处于预期范围：favorable",
          "相对年龄与实验室参考明显偏低：moderate_concern",
          "仅有 AMH 而无年龄/AFC/临床背景：不得高置信度",
        ],
      },
      {
        id: "afc",
        label: "基础窦卵泡计数 AFC",
        role: "key",
        weight: 1.3,
        anchors: [
          "由有经验中心测得且处于该中心预期范围：favorable",
          "明确较低或与 AMH 明显不一致：moderate_concern；提示需结合复核",
        ],
      },
      {
        id: "basal_fsh_e2",
        label: "基础 FSH 与 E2",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "基础期结果在实验室参考范围：favorable",
          "FSH 明显升高，或 E2 偏高可能掩盖 FSH：moderate_concern",
        ],
      },
      {
        id: "stimulation_response",
        label: "既往促排反应与实际取卵数",
        role: "key",
        weight: 1.5,
        anchors: [
          "既往实际反应与预期相符：favorable",
          "反复低反应或最大刺激下取卵数明显偏少：high_concern；这是直接证据",
        ],
      },
    ],
  },
  female_metabolic_health: {
    id: "female_metabolic_health",
    label: "代谢健康与体重管理",
    baseScore: 6.2,
    guardrails: [
      "BMI 只是筛查背景，不能替代体成分、代谢检查或个体化临床判断。",
    ],
    criteria: [
      {
        id: "weight_context",
        label: "体重、BMI 与近期变化",
        role: "supporting",
        weight: 0.9,
        anchors: [
          "BMI 位于实验室/人群常用正常范围且体重稳定：favorable",
          "明显偏低、超重/肥胖或短期显著变化：mild_concern 至 moderate_concern",
        ],
      },
      {
        id: "glycemic_context",
        label: "血糖、糖化与胰岛素背景",
        role: "key",
        weight: 1.3,
        anchors: [
          "相关指标正常且无糖代谢病史：favorable",
          "明确糖尿病、糖耐量异常或胰岛素抵抗：moderate_concern 至 high_concern",
        ],
      },
      {
        id: "cardiometabolic_history",
        label: "血压、血脂及代谢疾病史",
        role: "supporting",
        weight: 0.9,
        anchors: [
          "无相关病史且检查稳定：favorable",
          "高血压、脂代谢异常、脂肪肝或代谢综合征：moderate_concern",
        ],
      },
      {
        id: "activity_context",
        label: "日常活动与运动",
        role: "supporting",
        weight: 0.6,
        anchors: [
          "规律适量运动：favorable",
          "长期久坐且几乎无活动：mild_concern",
        ],
      },
    ],
  },
  female_immune_context: {
    id: "female_immune_context",
    label: "免疫与凝血相关背景",
    baseScore: 6.0,
    guardrails: [
      "无适应证时，不得因未做免疫、凝血、NK 或封闭抗体检查而扣分。",
      "仅对明确自身免疫病、血栓史、反复妊娠丢失等有临床指征的资料评分。",
    ],
    criteria: [
      {
        id: "autoimmune_diagnosis",
        label: "明确自身免疫疾病",
        role: "key",
        weight: 1.3,
        anchors: [
          "无病史且无相关症状：neutral",
          "明确自身免疫疾病并控制稳定：mild_concern",
          "活动期或控制不佳：high_concern",
        ],
      },
      {
        id: "aps_thrombosis",
        label: "抗磷脂综合征或血栓背景",
        role: "key",
        weight: 1.4,
        anchors: [
          "无相关病史：neutral",
          "经规范评估明确 APS、血栓或高风险凝血问题：high_concern",
        ],
      },
      {
        id: "rpl_indication",
        label: "反复妊娠丢失等检查指征",
        role: "supporting",
        weight: 1.0,
        anchors: [
          "无反复丢失背景：neutral",
          "存在反复妊娠丢失：mild_concern，提示定向评估，不得直接诊断免疫原因",
        ],
      },
      {
        id: "nonspecific_testing",
        label: "非特异性免疫检测",
        role: "supporting",
        weight: 0.3,
        anchors: [
          "未做广泛免疫筛查：unknown，不扣分",
          "孤立、边缘或未经核验的非特异结果：unknown 或 mild_concern",
        ],
      },
    ],
  },
  female_pelvic_environment: {
    id: "female_pelvic_environment",
    label: "输卵管与盆腔环境",
    baseScore: 6.3,
    guardrails: [
      "输卵管和盆腔结论应优先依据 HSG、SHG、超声、手术或医生记录。",
    ],
    criteria: [
      {
        id: "tubal_patency",
        label: "输卵管通畅与积水",
        role: "key",
        weight: 1.5,
        anchors: [
          "双侧通畅或符合当前受孕路径需要：favorable",
          "单侧阻塞：moderate_concern",
          "双侧阻塞或明确输卵管积水：high_concern",
        ],
      },
      {
        id: "endometriosis",
        label: "子宫内膜异位症背景",
        role: "key",
        weight: 1.2,
        anchors: [
          "无相关病史或影像线索：neutral",
          "明确内异症、巧克力囊肿或活动性症状：moderate_concern 至 high_concern",
        ],
      },
      {
        id: "pelvic_adhesion_surgery",
        label: "盆腔手术与粘连",
        role: "supporting",
        weight: 1.0,
        anchors: [
          "无盆腔手术/粘连背景：neutral",
          "既往盆腔手术、严重粘连或医生明确提示解剖影响：moderate_concern",
        ],
      },
      {
        id: "pelvic_infection",
        label: "盆腔感染史",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "无相关病史：neutral",
          "反复盆腔炎、衣原体等可能影响输卵管的感染史：moderate_concern",
        ],
      },
    ],
  },
  female_nutrition: {
    id: "female_nutrition",
    label: "营养储备与关键微量营养",
    baseScore: 6.2,
    guardrails: [
      "营养维度用于发现缺口，不为保健品品牌或高剂量方案背书。",
      "维生素 D 等指标与生育结局的因果关系有限，应以缺乏纠正和总体健康为主。",
    ],
    criteria: [
      {
        id: "iron_status",
        label: "铁储备与贫血背景",
        role: "key",
        weight: 1.1,
        anchors: [
          "血常规和铁储备无异常：favorable",
          "明确缺铁、低铁蛋白或贫血：moderate_concern 至 high_concern",
        ],
      },
      {
        id: "folate_b12",
        label: "叶酸与维生素 B12",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "饮食/补充符合备孕基本建议且无缺乏证据：favorable",
          "明确缺乏或高风险饮食模式：moderate_concern",
        ],
      },
      {
        id: "vitamin_d",
        label: "维生素 D 状态",
        role: "supporting",
        weight: 0.5,
        anchors: [
          "在实验室参考范围：favorable",
          "明确缺乏：mild_concern；不得据此推断不孕原因",
        ],
      },
      {
        id: "diet_quality",
        label: "饮食质量与能量摄入",
        role: "supporting",
        weight: 0.9,
        anchors: [
          "饮食多样、蛋白和蔬果摄入较稳定：favorable",
          "极端节食、长期营养不均或体重快速变化：moderate_concern",
        ],
      },
    ],
  },
  female_lifestyle: {
    id: "female_lifestyle",
    label: "生活方式与环境暴露",
    baseScore: 6.5,
    guardrails: [
      "只评价可调整暴露，不进行道德判断。",
    ],
    criteria: [
      {
        id: "nicotine",
        label: "吸烟与尼古丁暴露",
        role: "key",
        weight: 1.4,
        anchors: [
          "本人不吸烟且无明显二手烟：favorable",
          "当前吸烟、电子烟或显著二手烟暴露：high_concern",
        ],
      },
      {
        id: "alcohol_drugs",
        label: "酒精与非医疗药物",
        role: "supporting",
        weight: 0.9,
        anchors: [
          "无或低频饮酒、无药物滥用：favorable",
          "频繁饮酒、娱乐性药物或非医嘱使用影响生殖的药物：moderate_concern 至 high_concern",
        ],
      },
      {
        id: "exercise",
        label: "运动与久坐",
        role: "supporting",
        weight: 0.7,
        anchors: [
          "规律适量运动：favorable",
          "长期久坐、完全不运动或过度训练：mild_concern",
        ],
      },
      {
        id: "environmental_exposure",
        label: "职业与环境暴露",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "无明确高风险暴露：neutral",
          "明确接触生殖毒性物质、辐射或高强度溶剂等：moderate_concern",
        ],
      },
    ],
  },
  female_sleep_stress: {
    id: "female_sleep_stress",
    label: "心理情绪、压力与睡眠",
    baseScore: 6.3,
    guardrails: [
      "压力与睡眠评分反映支持需求，不把情绪问题归因为不孕原因。",
    ],
    criteria: [
      {
        id: "sleep_quality",
        label: "睡眠时长、规律与质量",
        role: "key",
        weight: 1.0,
        anchors: [
          "睡眠相对规律且恢复感良好：favorable",
          "长期失眠、严重不足或昼夜节律紊乱：moderate_concern",
        ],
      },
      {
        id: "distress_impact",
        label: "焦虑、抑郁与压力影响",
        role: "key",
        weight: 1.0,
        anchors: [
          "压力可控且日常功能稳定：favorable",
          "明显影响饮食、睡眠、工作或治疗坚持：moderate_concern 至 high_concern",
        ],
      },
      {
        id: "support_system",
        label: "伴侣与社会支持",
        role: "supporting",
        weight: 0.7,
        anchors: [
          "有稳定支持和沟通渠道：favorable",
          "明显孤立、关系冲突或缺乏支持：mild_concern",
        ],
      },
      {
        id: "shift_work",
        label: "夜班与节律负荷",
        role: "supporting",
        weight: 0.5,
        anchors: [
          "无长期夜班：neutral",
          "长期夜班或频繁跨时区：mild_concern",
        ],
      },
    ],
  },
  male_dna_integrity: {
    id: "male_dna_integrity",
    label: "精子 DNA 完整性与氧化应激",
    baseScore: 6.2,
    guardrails: [
      "DFI 并非所有人的常规必查项，不使用单一通用阈值替代实验室方法与临床情境。",
      "未检测 DFI 不得自动扣分。",
    ],
    criteria: [
      {
        id: "dfi_result",
        label: "精子 DNA 碎片检测",
        role: "key",
        weight: 1.4,
        anchors: [
          "按该实验室方法判断处于低风险范围：favorable",
          "实验室明确为升高或高风险：moderate_concern 至 high_concern",
          "未检测：unknown，不扣分",
        ],
      },
      {
        id: "oxidative_risk",
        label: "氧化应激相关暴露",
        role: "supporting",
        weight: 1.0,
        anchors: [
          "无吸烟、高热、近期高热或明显环境暴露：favorable",
          "吸烟、长期高热、近期高热、明显污染暴露：mild_concern 至 moderate_concern",
        ],
      },
      {
        id: "varicocele_context",
        label: "精索静脉曲张与睾丸背景",
        role: "supporting",
        weight: 0.9,
        anchors: [
          "无相关病史：neutral",
          "临床显著精索静脉曲张或睾丸疾病：moderate_concern",
        ],
      },
      {
        id: "art_rpl_context",
        label: "反复 ART 失败或妊娠丢失背景",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "无相关背景：neutral",
          "存在反复 ART 失败或两次及以上妊娠丢失：mild_concern，提示与男科医生讨论是否定向评估",
        ],
      },
    ],
  },
  male_morphology: {
    id: "male_morphology",
    label: "精子形态与结构质量",
    baseScore: 6.3,
    guardrails: [
      "WHO 第六版参考分布不是自然受孕或不孕的诊断分界；至少结合重复精液分析。",
    ],
    criteria: [
      {
        id: "normal_forms",
        label: "正常形态率",
        role: "key",
        weight: 1.5,
        anchors: [
          "按 WHO 第六版/实验室方法正常形态率约 4% 或以上：favorable",
          "低于实验室下限：moderate_concern；数值越低且重复出现，关注程度越高",
        ],
      },
      {
        id: "repeat_consistency",
        label: "重复检测一致性",
        role: "key",
        weight: 0.9,
        anchors: [
          "至少两次结果稳定且无明显异常：favorable",
          "仅单次异常或不同实验室差异大：unknown 或 mild_concern",
          "重复异常：moderate_concern",
        ],
      },
      {
        id: "sample_quality",
        label: "采样与实验室质量",
        role: "supporting",
        weight: 0.5,
        anchors: [
          "禁欲时间、完整采集和实验室质控信息合理：favorable",
          "采集不完整、发热后短期检测或质控不明：unknown",
        ],
      },
      {
        id: "structural_history",
        label: "睾丸、附睾与遗传结构背景",
        role: "supporting",
        weight: 0.7,
        anchors: [
          "无相关病史：neutral",
          "隐睾、睾丸损伤、遗传异常或明显生殖系统病史：moderate_concern",
        ],
      },
    ],
  },
  male_motility: {
    id: "male_motility",
    label: "精子活力与前向运动",
    baseScore: 6.3,
    guardrails: [
      "WHO 第六版下限用于实验室解释，不是个人生育力诊断线。",
    ],
    criteria: [
      {
        id: "progressive_motility",
        label: "前向运动率 PR",
        role: "key",
        weight: 1.3,
        anchors: [
          "约 30% 或以上且符合实验室参考：favorable",
          "低于实验室下限：moderate_concern；重复明显偏低可 high_concern",
        ],
      },
      {
        id: "total_motility",
        label: "总活力",
        role: "key",
        weight: 1.0,
        anchors: [
          "约 42% 或以上且符合实验室参考：favorable",
          "低于实验室下限：moderate_concern",
        ],
      },
      {
        id: "repeat_sample_context",
        label: "重复检测与样本情境",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "重复结果稳定：favorable",
          "仅一次检测、采集不完整或近期发热：unknown 或 mild_concern",
        ],
      },
      {
        id: "reversible_factors",
        label: "精索静脉曲张、药物与高热",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "无明显可逆风险：neutral",
          "明显高热、精索静脉曲张或影响生精的药物暴露：moderate_concern",
        ],
      },
    ],
  },
  male_concentration: {
    id: "male_concentration",
    label: "精子浓度与总数",
    baseScore: 6.3,
    guardrails: [
      "浓度必须结合精液量和总精子数解释；单次低值不等同男性不育。",
    ],
    criteria: [
      {
        id: "concentration",
        label: "精子浓度",
        role: "key",
        weight: 1.2,
        anchors: [
          "约 16 百万/mL 或以上且符合实验室参考：favorable",
          "低于实验室下限：moderate_concern；明显低值或无精子：high_concern",
        ],
      },
      {
        id: "total_sperm_number",
        label: "一次射精总精子数",
        role: "key",
        weight: 1.3,
        anchors: [
          "约 39 百万/次或以上且符合实验室参考：favorable",
          "低于实验室下限：moderate_concern；明显低值：high_concern",
        ],
      },
      {
        id: "repeat_consistency",
        label: "重复精液分析",
        role: "key",
        weight: 0.8,
        anchors: [
          "至少两次结果稳定：favorable",
          "仅一次异常：unknown 或 mild_concern",
          "重复异常：moderate_concern",
        ],
      },
      {
        id: "testicular_history",
        label: "睾丸、生精与治疗史",
        role: "supporting",
        weight: 0.9,
        anchors: [
          "无相关病史：neutral",
          "隐睾、化疗放疗、睾丸损伤或严重生殖系统病史：high_concern",
        ],
      },
    ],
  },
  male_semen_volume: {
    id: "male_semen_volume",
    label: "精液量与基础参数",
    baseScore: 6.3,
    guardrails: [
      "精液量低首先需排除采集不完整和禁欲时间影响，再讨论生殖道因素。",
    ],
    criteria: [
      {
        id: "semen_volume",
        label: "精液量",
        role: "key",
        weight: 1.2,
        anchors: [
          "约 1.4 mL 或以上且符合实验室参考：favorable",
          "低于实验室下限：moderate_concern；需先核对采集完整性",
        ],
      },
      {
        id: "collection_context",
        label: "采集完整性与禁欲时间",
        role: "key",
        weight: 0.9,
        anchors: [
          "完整采集且禁欲时间符合实验室要求：favorable",
          "遗漏前段、禁欲时间异常或样本运输不当：unknown",
        ],
      },
      {
        id: "basic_parameters",
        label: "液化、黏稠度、pH 等",
        role: "supporting",
        weight: 0.7,
        anchors: [
          "实验室记录无异常：favorable",
          "反复液化异常、显著黏稠或 pH 异常：mild_concern 至 moderate_concern",
        ],
      },
      {
        id: "ejaculatory_history",
        label: "射精与泌尿生殖症状",
        role: "supporting",
        weight: 0.9,
        anchors: [
          "无症状：neutral",
          "逆行射精、射精困难或精液显著减少：moderate_concern 至 high_concern",
        ],
      },
    ],
  },
  male_hormonal_balance: {
    id: "male_hormonal_balance",
    label: "男性激素与生精背景",
    baseScore: 6.2,
    guardrails: [
      "男性激素检测应结合症状、精液异常和体检指征，不因未检查而扣分。",
    ],
    criteria: [
      {
        id: "clinical_signs",
        label: "性功能、第二性征与睾丸线索",
        role: "key",
        weight: 1.0,
        anchors: [
          "无相关症状且体检无异常：neutral 或 favorable",
          "性欲明显下降、勃起问题、睾丸体积异常等：moderate_concern",
        ],
      },
      {
        id: "testosterone",
        label: "睾酮结果",
        role: "supporting",
        weight: 1.0,
        anchors: [
          "按规范晨间检测和实验室参考正常：favorable",
          "重复晨间总睾酮明显偏低：moderate_concern",
        ],
      },
      {
        id: "fsh_lh",
        label: "FSH/LH 与生精轴",
        role: "supporting",
        weight: 1.0,
        anchors: [
          "结合睾酮和精液结果无明显异常：favorable",
          "明显异常提示原发或继发性轴问题：moderate_concern 至 high_concern",
        ],
      },
      {
        id: "exogenous_androgen",
        label: "外源性睾酮或合成代谢类固醇",
        role: "key",
        weight: 1.5,
        anchors: [
          "无使用：favorable",
          "当前使用或近期使用外源性睾酮/合成代谢类固醇：high_concern",
        ],
      },
    ],
  },
  male_inflammation: {
    id: "male_inflammation",
    label: "泌尿生殖炎症相关背景",
    baseScore: 6.2,
    guardrails: [
      "外周血白细胞升高不能直接推断精液或生殖道炎症。",
      "不在无症状人群中把广泛感染筛查当作必查。",
    ],
    criteria: [
      {
        id: "semen_inflammation",
        label: "精液白细胞与培养",
        role: "key",
        weight: 1.2,
        anchors: [
          "精液白细胞/培养无异常：favorable",
          "规范检查提示白细胞精液症或培养阳性：moderate_concern",
        ],
      },
      {
        id: "sti_prostatitis",
        label: "性传播感染与前列腺/附睾病史",
        role: "key",
        weight: 1.2,
        anchors: [
          "无相关病史：neutral",
          "明确感染、前列腺炎、附睾炎或治疗未完成：moderate_concern 至 high_concern",
        ],
      },
      {
        id: "urogenital_symptoms",
        label: "泌尿生殖症状",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "无疼痛、分泌物、排尿或射精不适：favorable",
          "持续相关症状：moderate_concern",
        ],
      },
      {
        id: "systemic_markers",
        label: "全身炎症指标",
        role: "supporting",
        weight: 0.3,
        anchors: [
          "单独血常规或 CRP 异常：unknown，不得直接判定生殖道炎症",
        ],
      },
    ],
  },
  male_nutrition: {
    id: "male_nutrition",
    label: "营养储备与抗氧化支持",
    baseScore: 6.2,
    guardrails: [
      "营养维度不输出品牌推荐或未经指征的高剂量抗氧化方案。",
    ],
    criteria: [
      {
        id: "weight_diet",
        label: "体重与饮食质量",
        role: "key",
        weight: 1.0,
        anchors: [
          "体重相对稳定、饮食多样：favorable",
          "肥胖、明显偏瘦、极端饮食或长期营养不均：moderate_concern",
        ],
      },
      {
        id: "documented_deficiency",
        label: "明确营养缺乏",
        role: "key",
        weight: 1.0,
        anchors: [
          "无贫血或明确缺乏：favorable",
          "铁、叶酸、B12、维生素 D 等明确缺乏：moderate_concern",
        ],
      },
      {
        id: "supplement_safety",
        label: "补充剂使用安全",
        role: "supporting",
        weight: 0.6,
        anchors: [
          "剂量清楚且经专业人员核对：favorable",
          "多种重复、高剂量或成分不明补充剂：mild_concern",
        ],
      },
      {
        id: "metabolic_context",
        label: "代谢病与营养吸收背景",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "无相关病史：neutral",
          "糖尿病、胃肠吸收问题或影响营养状态的慢性病：moderate_concern",
        ],
      },
    ],
  },
  male_lifestyle: {
    id: "male_lifestyle",
    label: "生活方式与生殖环境暴露",
    baseScore: 6.5,
    guardrails: [
      "只评价可调整暴露，不把单一生活方式因素解释为确定病因。",
    ],
    criteria: [
      {
        id: "nicotine",
        label: "吸烟与尼古丁",
        role: "key",
        weight: 1.3,
        anchors: [
          "不吸烟且无明显二手烟：favorable",
          "当前吸烟、电子烟或明显二手烟：high_concern",
        ],
      },
      {
        id: "heat_exposure",
        label: "高温与局部热暴露",
        role: "key",
        weight: 1.0,
        anchors: [
          "无长期桑拿、热浴、膝上电脑或高温职业暴露：favorable",
          "长期或频繁高温暴露：moderate_concern",
        ],
      },
      {
        id: "alcohol_drugs_androgens",
        label: "酒精、娱乐性药物与雄激素",
        role: "key",
        weight: 1.2,
        anchors: [
          "无明显暴露：favorable",
          "重度饮酒、娱乐性药物或外源雄激素：high_concern",
        ],
      },
      {
        id: "exercise_occupation",
        label: "运动、久坐与职业暴露",
        role: "supporting",
        weight: 0.8,
        anchors: [
          "规律适量运动且职业暴露低：favorable",
          "长期久坐、过度骑行或生殖毒性职业暴露：mild_concern 至 moderate_concern",
        ],
      },
    ],
  },
  male_sleep_stress: {
    id: "male_sleep_stress",
    label: "心理情绪、压力与睡眠",
    baseScore: 6.3,
    guardrails: [
      "压力与睡眠用于识别支持需求，不直接归因精液异常。",
    ],
    criteria: [
      {
        id: "sleep_quality",
        label: "睡眠时长、规律与质量",
        role: "key",
        weight: 1.0,
        anchors: [
          "睡眠相对规律且恢复感良好：favorable",
          "长期失眠、睡眠严重不足或节律紊乱：moderate_concern",
        ],
      },
      {
        id: "distress_impact",
        label: "压力与情绪影响",
        role: "key",
        weight: 1.0,
        anchors: [
          "压力可控且日常功能稳定：favorable",
          "明显影响关系、性功能、工作或治疗坚持：moderate_concern 至 high_concern",
        ],
      },
      {
        id: "support_system",
        label: "伴侣与社会支持",
        role: "supporting",
        weight: 0.7,
        anchors: [
          "有稳定支持：favorable",
          "明显孤立或关系冲突：mild_concern",
        ],
      },
      {
        id: "shift_work",
        label: "夜班与节律负荷",
        role: "supporting",
        weight: 0.5,
        anchors: [
          "无长期夜班：neutral",
          "长期夜班或频繁跨时区：mild_concern",
        ],
      },
    ],
  },
};

export const getFertilityScoringRule = (id: string) => FERTILITY_SCORING_RULES[id];

export const getFertilityScoreBand = (score: number) =>
  FERTILITY_SCORE_BANDS.find((band) => score >= band.min) ?? FERTILITY_SCORE_BANDS.at(-1)!;
