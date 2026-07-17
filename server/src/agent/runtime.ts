import { agentGraph } from "./graph";
import type { AgentGraphInput, AgentGraphOutput } from "./types";

export type AgentRuntimeName = "pi_loop" | "langgraph";

const AGENT_RUNTIME_ENV = "MIRA_AGENT_RUNTIME";

export const resolveAgentRuntimeName = (): AgentRuntimeName => {
  const requestedRuntime = process.env[AGENT_RUNTIME_ENV]?.trim().toLowerCase();
  if (requestedRuntime === "langgraph") {
    return "langgraph";
  }
  if (requestedRuntime === "pi_loop") {
    return "pi_loop";
  }
  return process.env.NODE_ENV === "test" ? "langgraph" : "pi_loop";
};

export const runAgentRuntime = (
  input: AgentGraphInput,
): Promise<AgentGraphOutput> => agentGraph.run(input);
