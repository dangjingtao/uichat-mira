import { agentGraph } from "./graph";
import { piAgentLoop } from "./pi-loop";
import type { AgentGraphInput, AgentGraphOutput } from "./types";

export type AgentRuntimeName = "pi_loop" | "langgraph";

const AGENT_RUNTIME_ENV = "MIRA_AGENT_RUNTIME";

export const resolveAgentRuntimeName = (): AgentRuntimeName =>
  process.env[AGENT_RUNTIME_ENV]?.trim().toLowerCase() === "langgraph"
    ? "langgraph"
    : "pi_loop";

export const runAgentRuntime = (
  input: AgentGraphInput,
): Promise<AgentGraphOutput> =>
  resolveAgentRuntimeName() === "langgraph"
    ? agentGraph.run(input)
    : piAgentLoop.run(input);
