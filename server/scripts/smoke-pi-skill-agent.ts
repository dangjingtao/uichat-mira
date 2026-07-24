import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { agentGraph } from "../src/agent/graph/index.js";
import { createAgentGoal } from "../src/agent/nodes/goal-plan.js";
import type {
  AgentApprovedInvocation,
  AgentGraphInput,
  AgentGraphOutput,
} from "../src/agent/types.js";
import type { AssistantExecutionNodeEvent } from "../src/services/chat-stream-events.js";
import { getSkillAgentExecutionProfile } from "../src/skills/agent/profiles.js";

type SkillId = "docx" | "pdf" | "pptx" | "xlsx";
type Cli = { skill: SkillId; workspace: string; inputPath?: string };

const fail = (message: string): never => {
  console.error(`[pi-skill-smoke] FAIL: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
};

const parseArgs = (): Cli => {
  const args = process.argv.slice(2);
  const read = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const skill = read("--skill") as SkillId | undefined;
  if (!skill || !["docx", "pdf", "pptx", "xlsx"].includes(skill)) {
    return fail(
      "Usage: pnpm smoke:pi-skill-agent -- --skill docx|pdf|pptx|xlsx [--workspace PATH] [--input EXISTING.xlsx]",
    );
  }
  return {
    skill,
    workspace: path.resolve(
      read("--workspace") ??
        path.join(process.cwd(), ".test-artifact", "pi-skill-agent-smoke", skill),
    ),
    inputPath: read("--input"),
  };
};

const goalFor = (cli: Cli) => {
  if (cli.skill === "docx") {
    return "Create smoke.docx in the current workspace. It must contain the title 'Pi Skill Agent Smoke', three short sections, and a simple two-column table. Use the docx Skill private runtime and return grounded artifact evidence.";
  }
  if (cli.skill === "pdf") {
    return "Create smoke.pdf in the current workspace with the title 'Pi Skill Agent Smoke' and two short sections. Use the pdf Skill private runtime and return grounded artifact evidence.";
  }
  if (cli.skill === "pptx") {
    return "Create smoke.pptx in the current workspace with exactly two simple slides: a title slide and a summary slide. Use the pptx Skill private runtime. Do not construct or run Python commands yourself; use the managed presentation runtime and return grounded artifact evidence.";
  }
  if (!cli.inputPath) {
    return fail(
      "XLSX XML-first create/edit bridge is still pending. Pass --input <workspace-relative existing.xlsx> to smoke diagnostics/read instead of faking create support.",
    );
  }
  const absolute = path.resolve(cli.workspace, cli.inputPath);
  if (!absolute.startsWith(`${cli.workspace}${path.sep}`) && absolute !== cli.workspace) {
    return fail("--input must stay inside --workspace");
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return fail(`XLSX smoke input does not exist: ${absolute}`);
  }
  return `Inspect and verify the existing workbook ${cli.inputPath}. Do not create or modify a workbook. Use only the xlsx Skill's scoped read/diagnostics capabilities and report grounded evidence.`;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const collectArtifactPaths = (output: AgentGraphOutput) => {
  const paths = new Set<string>();
  for (const observation of output.evidence.observations) {
    const data = asRecord(observation.summary?.data);
    if (data?.kind !== "generic_structured") continue;
    const preview = asRecord(data.preview);
    for (const artifactValue of Array.isArray(preview?.artifacts) ? preview.artifacts : []) {
      const artifact = asRecord(artifactValue);
      const metadata = asRecord(artifact?.metadata);
      const candidate =
        typeof metadata?.path === "string"
          ? metadata.path
          : typeof artifact?.path === "string"
            ? artifact.path
            : undefined;
      if (candidate) paths.add(candidate);
    }
  }
  return [...paths];
};

const getLastSkillDoneEvent = (events: AssistantExecutionNodeEvent[]) =>
  [...events]
    .reverse()
    .find(
      (event) =>
        event.nodeId === "agent-forked-skill-agent" && event.phase === "done",
    );

const print = (label: string, value: unknown) =>
  console.log(`${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`);

const main = async () => {
  const cli = parseArgs();
  fs.mkdirSync(cli.workspace, { recursive: true });
  process.env.MIRA_AGENT_RUNTIME = "pi_loop";
  process.env.MIRA_SKILL_AGENT_RUNTIME = "pi-core";

  const profile = getSkillAgentExecutionProfile(cli.skill);
  if (!profile) return fail(`No Pi Skill execution profile for ${cli.skill}`);

  const goalText = goalFor(cli);
  const events: AssistantExecutionNodeEvent[] = [];
  const runId = crypto.randomUUID();
  const baseInput: AgentGraphInput = {
    runId,
    threadId: `smoke-pi-skill-agent:${cli.skill}:${runId}`,
    userId: 1,
    goal: createAgentGoal(goalText),
    messages: [
      {
        role: "user",
        content: goalText,
        parts: [{ type: "text", text: goalText }],
      },
    ],
    workspaceRoot: cli.workspace,
    onExecutionNode: (event) => events.push(event),
  };

  print("skillId", cli.skill);
  print("engine", profile.engine);
  print("workspace", cli.workspace);
  print("toolExposure", profile.allowedHarnessToolIds);
  print("privateRuntime", profile.runtimeBindings);

  let output = await agentGraph.run(baseInput);
  print(
    "approval pause/resume",
    output.status === "waiting_approval" ? "paused" : "not_required",
  );

  if (output.status === "waiting_approval") {
    const pendingApproval = output.pendingApproval;
    const pendingToolCall = output.pendingToolCall;
    if (!pendingApproval || !pendingToolCall) {
      return fail(
        "waiting_approval output did not preserve exact pendingApproval + pendingToolCall",
      );
    }
    if (pendingApproval.toolId !== pendingToolCall.toolId) {
      return fail("approval toolId does not match frozen pendingToolCall.toolId");
    }
    if (pendingApproval.inputHash !== pendingToolCall.inputHash) {
      return fail("approval inputHash does not match frozen pendingToolCall.inputHash");
    }
    if (!("origin" in pendingToolCall) || pendingToolCall.origin !== "skill_agent") {
      return fail("forked Skill approval was not marked origin=skill_agent");
    }

    const approvedInvocation: AgentApprovedInvocation = {
      toolId: pendingToolCall.toolId,
      input: structuredClone(pendingToolCall.args),
      inputHash: pendingToolCall.inputHash,
      approvedAt: new Date().toISOString(),
      approvalId: pendingApproval.id,
    };
    output = await agentGraph.run({
      ...baseInput,
      pendingToolCall,
      approvedInvocations: [approvedInvocation],
    });
    print("approval pause/resume", "resumed_exact_invocation");
  }

  const skillDetails = asRecord(getLastSkillDoneEvent(events)?.details);
  const toolCalls = Array.isArray(skillDetails?.toolCalls) ? skillDetails.toolCalls : [];
  const plannerEvents = events.filter(
    (event) => event.nodeId === "agent-next-action-planner",
  );
  const artifactPaths = collectArtifactPaths(output);
  const artifactStats = artifactPaths.map((artifactPath) => {
    const absolute = path.resolve(cli.workspace, artifactPath);
    if (
      absolute !== cli.workspace &&
      !absolute.startsWith(`${cli.workspace}${path.sep}`)
    ) {
      return fail(`artifact escaped workspace: ${artifactPath}`);
    }
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      return fail(`artifact does not exist: ${absolute}`);
    }
    const bytes = fs.statSync(absolute).size;
    if (bytes <= 0) return fail(`artifact is empty: ${absolute}`);
    return { path: artifactPath, bytes };
  });

  print("toolCalls", toolCalls);
  print("result status", output.status);
  print(
    "evidence count",
    output.evidence.observations.length +
      output.evidence.toolExecutions.length +
      output.evidence.retrievals.length,
  );
  print("artifact paths", artifactPaths);
  print("artifact byte sizes", artifactStats);
  print("mainPlanner execution events", plannerEvents.length);

  if (output.status !== "completed") {
    return fail(
      `expected completed output, received ${output.status}: ${output.errorMessage ?? output.blockedReason ?? "unknown"}`,
    );
  }
  if (plannerEvents.length !== 0) {
    return fail(
      "Main Planner emitted execution events after forked Skill ownership; completed Skill was not finalized directly",
    );
  }
  if (cli.skill !== "xlsx" && artifactStats.length === 0) {
    return fail(`${cli.skill} smoke completed without a non-empty workspace artifact`);
  }

  console.log("[pi-skill-smoke] PASS");
};

main().catch((error) => {
  if (!process.exitCode) process.exitCode = 1;
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
});
