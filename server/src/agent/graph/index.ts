import { runWithAgentRunSpan } from "../observability";
import type { AgentGraphInput, AgentGraphOutput } from "../types";
import { compiledAgentStateGraph } from "./build-graph";
import { mapGraphStateToOutput } from "./output";
import {
  AGENT_EMIT_CONFIG_KEY,
  createInitialAgentGraphState,
} from "./state";

export const agentGraph = {
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
