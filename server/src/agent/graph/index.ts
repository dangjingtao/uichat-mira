import { runWithAgentRunSpan } from "../observability";
import { piAgentLoop } from "../pi-loop";
import type { AgentGraphInput, AgentGraphOutput } from "../types";
import { compiledAgentStateGraph } from "./build-graph";
import { mapGraphStateToOutput } from "./output";
import {
  AGENT_EMIT_CONFIG_KEY,
  createInitialAgentGraphState,
} from "./state";

const shouldUseLangGraphRuntime = () =>
  process.env.MIRA_AGENT_RUNTIME?.trim().toLowerCase() === "langgraph";

export const langGraphAgent = {
  async run(input: AgentGraphInput): Promise<AgentGraphOutput> {
    return runWithAgentRunSpan({
      graphInput: input,
      run: async () => {
        const state = await compiledAgentStateGraph.invoke(createInitialAgentGraphState(input), {
          configurable: {
            [AGENT_EMIT_CONFIG_KEY]: input.onExecutionNode,
          },
        });

        return mapGraphStateToOutput(state);
      },
      summarizeResult: (result) => result,
    });
  },

  get graph() {
    return compiledAgentStateGraph;
  },
};

/**
 * Stable agent runtime facade used by both new runs and approval resume.
 * Pi loop is the branch default; set MIRA_AGENT_RUNTIME=langgraph to compare
 * against the previous graph orchestration without changing call sites.
 */
export const agentGraph = {
  run(input: AgentGraphInput): Promise<AgentGraphOutput> {
    return shouldUseLangGraphRuntime()
      ? langGraphAgent.run(input)
      : piAgentLoop.run(input);
  },

  get graph() {
    return compiledAgentStateGraph;
  },
};
