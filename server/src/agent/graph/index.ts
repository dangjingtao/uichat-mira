import { runWithAgentRunSpan } from "../observability";
import { piAgentLoop } from "../pi-loop";
import { agentRunStore } from "../run-store";
import {
  applyAgentRuntimeCheckpoint,
  getAgentRuntimeCheckpoint,
  persistAgentRuntimeCheckpoint,
} from "../runtime-checkpoint";
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

const restorePersistedRuntimeInput = (input: AgentGraphInput) => {
  const run = agentRunStore.get(input.runId);
  return {
    run,
    input: applyAgentRuntimeCheckpoint(
      input,
      getAgentRuntimeCheckpoint(run?.runtimeInput),
    ),
  };
};

const persistRuntimeOutput = (input: {
  runId: string;
  runtimeInput: ReturnType<typeof agentRunStore.get> extends infer T
    ? T extends { runtimeInput?: infer R }
      ? R
      : never
    : never;
  output: AgentGraphOutput;
}) => {
  if (!input.runtimeInput) {
    return;
  }

  agentRunStore.update(input.runId, {
    runtimeInput: persistAgentRuntimeCheckpoint(input.runtimeInput, input.output),
  });
};

/**
 * Stable agent runtime facade used by both new runs and approval resume.
 * Pi loop is the branch default; set MIRA_AGENT_RUNTIME=langgraph to compare
 * against the previous graph orchestration without changing call sites.
 */
export const agentGraph = {
  async run(input: AgentGraphInput): Promise<AgentGraphOutput> {
    const restored = restorePersistedRuntimeInput(input);
    const output = shouldUseLangGraphRuntime()
      ? await langGraphAgent.run(restored.input)
      : await piAgentLoop.run(restored.input);

    persistRuntimeOutput({
      runId: input.runId,
      runtimeInput: restored.run?.runtimeInput,
      output,
    });

    return output;
  },

  get graph() {
    return compiledAgentStateGraph;
  },
};
