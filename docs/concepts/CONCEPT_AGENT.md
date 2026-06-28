# Agent

Status: Current
Owner: docs
Last verified: 2026-06-27
Layer: wiki
Module: Chat
Feature: AgentCore
Doc Type: overview
Canonical: true

## 目的

这份文档记录：在本项目里，一个模块要被称为 Agent，至少应该具备什么能力。

简短定义：

> Agent 是一个目标驱动的运行时循环：它能理解目标、检查上下文、制定计划、使用工具、观察结果、更新记忆，并决定继续执行、请求审批、追问用户或结束任务。

这还不是实现契约，而是用于讨论后续 chat、RAG、tool 和 workflow 能力的概念 POC。

## 研究依据

公开资料对 AI agent 的定义基本收敛到同一种结构：

- IBM 将 AI agent 描述为能基于可用工具自主设计工作流并完成任务的系统。
- Google Cloud 强调 AI agent 是能追求目标、为用户完成任务，并具备推理、规划和记忆能力的软件系统。
- AWS 强调 AI agent 会与环境交互、收集数据，并朝预设目标执行自导向任务。
- Google Cloud 的 agent 架构资料将 reasoning loop、memory、tool integration 视为可复用核心能力。
- AWS Marketplace 的学习资料把 agent loop 描述为：评估上下文、规划、调用工具/数据、观察结果，并持续调整，直到目标完成、延后或升级处理。

参考资料：

- https://www.ibm.com/think/topics/ai-agents
- https://cloud.google.com/discover/what-are-ai-agents
- https://aws.amazon.com/what-is/ai-agents/
- https://docs.cloud.google.com/architecture/choose-agentic-ai-architecture-components
- https://aws.amazon.com/marketplace/build-learn/ai-agent-learning-series/introduction-to-ai-agents

## 核心能力

一个 Agent 模块至少应具备以下能力，才配得上这个名字：

1. 目标接收
   - 接收用户或系统目标。
   - 将目标标准化为任务，包含成功条件、约束和风险等级。

2. 上下文感知
   - 读取当前对话、选中文档、RAG 结果、工具输出、应用状态或外部事件。
   - 区分已观察事实和推测假设。

3. 规划
   - 将目标拆成有顺序的步骤。
   - 选择工具和数据源。
   - 判断哪些步骤需要用户审批。

4. 工具行动
   - 通过受控接口调用已注册工具。
   - 执行前校验工具输入。
   - 捕获输出、错误和副作用。

5. 观察反馈
   - 将结果与成功条件比较。
   - 当结果不足时重试、调整计划或升级处理。

6. 记忆
   - 维护短期任务状态。
   - 只有在被允许时才持久化事实、偏好和决策。
   - 记录为什么做出某个决策，而不只是记录决策结果。

7. 自主边界
   - 对低风险、可逆步骤可以自主推进。
   - 对破坏性、昂贵、外部副作用或策略敏感动作必须请求审批。
   - 在目标完成、阻塞或不安全时停止。

8. 可追踪性
   - 产出执行轨迹：目标、计划、动作、观察、记忆写入、审批门禁和最终结果。

## 非目标

Agent 不应被理解为：

- 单个 LLM prompt。
- 聊天机器人 persona。
- 盲目的工具调用器。
- 永远无人监督的后台任务。
- 为不确定行为兜底的兼容层。

## POC: TypeScript 风格模块形状

```ts
type RiskLevel = "low" | "medium" | "high";

type AgentGoal = {
  id: string;
  text: string;
  successCriteria: string[];
  constraints: string[];
  riskLevel: RiskLevel;
};

type AgentContext = {
  conversation: unknown[];
  retrievedDocs: unknown[];
  appState: Record<string, unknown>;
  observations: AgentObservation[];
  memory: AgentMemorySnapshot;
};

type AgentPlanStep = {
  id: string;
  intent: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  requiresApproval: boolean;
  expectedObservation: string;
};

type AgentPlan = {
  goalId: string;
  steps: AgentPlanStep[];
  currentStepIndex: number;
};

type AgentObservation = {
  stepId: string;
  status: "ok" | "failed" | "partial" | "blocked";
  facts: string[];
  errors: string[];
  rawOutput?: unknown;
};

type AgentDecision =
  | { type: "continue"; plan: AgentPlan }
  | { type: "askApproval"; step: AgentPlanStep; reason: string }
  | { type: "askUser"; question: string; reason: string }
  | { type: "finish"; answer: string; trace: AgentTrace }
  | { type: "blocked"; reason: string; trace: AgentTrace };

type AgentMemorySnapshot = {
  shortTerm: Record<string, unknown>;
  durableFacts: Record<string, unknown>;
};

type AgentTrace = {
  goal: AgentGoal;
  plans: AgentPlan[];
  observations: AgentObservation[];
  memoryWrites: Array<{ key: string; value: unknown; reason: string }>;
};

type AgentTool = {
  name: string;
  description: string;
  riskLevel: RiskLevel;
  run(input: Record<string, unknown>): Promise<unknown>;
};
```

## POC: Agent Loop

```ts
class Agent {
  constructor(
    private readonly planner: Planner,
    private readonly tools: ToolRegistry,
    private readonly memory: AgentMemoryStore,
    private readonly policy: AgentPolicy,
    private readonly evaluator: AgentEvaluator,
  ) {}

  async run(goalText: string, initialContext: Partial<AgentContext>): Promise<AgentDecision> {
    const goal = await this.planner.normalizeGoal(goalText, initialContext);
    const trace: AgentTrace = {
      goal,
      plans: [],
      observations: [],
      memoryWrites: [],
    };

    let context = await this.buildContext(initialContext);
    let plan = await this.planner.createPlan(goal, context);
    trace.plans.push(plan);

    while (true) {
      const step = plan.steps[plan.currentStepIndex];

      if (!step) {
        const verdict = await this.evaluator.evaluateGoal(goal, context);
        if (verdict.complete) {
          return { type: "finish", answer: verdict.answer, trace };
        }

        if (verdict.needsUserInput) {
          return {
            type: "askUser",
            question: verdict.question,
            reason: verdict.reason,
          };
        }

        plan = await this.planner.replan(goal, context, verdict.reason);
        trace.plans.push(plan);
        continue;
      }

      const approval = this.policy.checkApproval(goal, step);
      if (approval.required) {
        return { type: "askApproval", step, reason: approval.reason };
      }

      const observation = await this.executeStep(step);
      trace.observations.push(observation);
      context = await this.observe(context, observation);

      const memoryWrite = await this.memory.maybeWrite(goal, step, observation);
      if (memoryWrite) {
        trace.memoryWrites.push(memoryWrite);
      }

      const stepVerdict = await this.evaluator.evaluateStep(goal, step, observation, context);

      if (stepVerdict.blocked) {
        return { type: "blocked", reason: stepVerdict.reason, trace };
      }

      if (stepVerdict.requiresReplan) {
        plan = await this.planner.replan(goal, context, stepVerdict.reason);
        trace.plans.push(plan);
        continue;
      }

      plan = {
        ...plan,
        currentStepIndex: plan.currentStepIndex + 1,
      };
    }
  }

  private async executeStep(step: AgentPlanStep): Promise<AgentObservation> {
    if (!step.toolName) {
      return {
        stepId: step.id,
        status: "ok",
        facts: [`Internal reasoning step completed: ${step.intent}`],
        errors: [],
      };
    }

    const tool = this.tools.get(step.toolName);

    try {
      const rawOutput = await tool.run(step.toolInput ?? {});
      return {
        stepId: step.id,
        status: "ok",
        facts: this.extractFacts(rawOutput),
        errors: [],
        rawOutput,
      };
    } catch (error) {
      return {
        stepId: step.id,
        status: "failed",
        facts: [],
        errors: [String(error)],
      };
    }
  }

  private async buildContext(initialContext: Partial<AgentContext>): Promise<AgentContext> {
    return {
      conversation: initialContext.conversation ?? [],
      retrievedDocs: initialContext.retrievedDocs ?? [],
      appState: initialContext.appState ?? {},
      observations: initialContext.observations ?? [],
      memory: await this.memory.snapshot(),
    };
  }

  private async observe(
    context: AgentContext,
    observation: AgentObservation,
  ): Promise<AgentContext> {
    return {
      ...context,
      observations: [...context.observations, observation],
      memory: await this.memory.snapshot(),
    };
  }

  private extractFacts(rawOutput: unknown): string[] {
    // 真实实现里应优先使用结构化 tool result schema。
    return [JSON.stringify(rawOutput)];
  }
}
```

## POC: 最小策略

```ts
class AgentPolicy {
  checkApproval(goal: AgentGoal, step: AgentPlanStep): { required: boolean; reason: string } {
    if (step.requiresApproval) {
      return {
        required: true,
        reason: "计划已明确标记该步骤需要审批。",
      };
    }

    if (goal.riskLevel === "high") {
      return {
        required: true,
        reason: "高风险目标在行动前需要用户审批。",
      };
    }

    return { required: false, reason: "" };
  }
}
```

## 完成边界

Agent loop 应以以下五种结果之一停止：

- `finish`：成功条件已满足。
- `askApproval`：下一步动作必须获得明确审批。
- `askUser`：缺少必要产品意图或业务信息。
- `blocked`：多次尝试后仍无法推进。
- `unsafe`：策略门禁拒绝该请求。

## 开放问题

- Agent 应该是 backend runtime module、renderer orchestration concept，还是跨两端共享的协议？
- Plan 是否应该作为一等记录持久化，用于审计和重放？
- 哪个现有 chat trace 格式应成为 canonical AgentTrace？
- RAG retrieval 应表示为工具、感知能力，还是两者都是？

## 相关文档

- `../uchat.md`
- `../chat/chat-tool-integration-poc.md`
- `../chat/chat-execution-trace-design.md`
- `../tooling-runtime/tools-protocol.md`
- `../architecture/README.md`
