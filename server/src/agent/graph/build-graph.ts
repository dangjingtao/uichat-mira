import { END, START, StateGraph } from "@langchain/langgraph";
import {
  evaluateNode,
  approvalNode,
  errorNode,
  generateNode,
  nextActionPlannerNode,
  planNode,
  policyNode,
  prepareContextNode,
  retrieveNode,
  toolCallNormalizeNode,
  toolNode,
} from "../nodes/index";
import { toolGuardNode, toolSelectNode } from "../intent/index";
import { AgentGraphStateAnnotation, createAgentNode } from "./state";
import {
  routeAfterApproval,
  routeAfterEvaluate,
  routeAfterGenerate,
  routeAfterNextAction,
  routeAfterPlanStep,
  routeAfterPolicy,
  routeAfterPrepareContext,
  routeAfterRetrieve,
  routeAfterTool,
  routeAfterToolCallNormalize,
  routeAfterToolGuard,
  routeAfterToolSelect,
} from "./routes";

export const compiledAgentStateGraph = new StateGraph(AgentGraphStateAnnotation)
  .addNode(
    "prepareContext",
    createAgentNode("prepareContext", prepareContextNode),
  )
  .addNode("planStep", createAgentNode("planStep", planNode))
  .addNode("toolSelectStep", createAgentNode("toolSelectStep", toolSelectNode))
  .addNode("toolGuardStep", createAgentNode("toolGuardStep", toolGuardNode))
  .addNode(
    "nextActionPlanner",
    createAgentNode("nextActionPlanner", nextActionPlannerNode),
  )
  .addNode(
    "toolCallNormalize",
    createAgentNode("toolCallNormalize", toolCallNormalizeNode),
  )
  .addNode("policyStep", createAgentNode("policyStep", policyNode))
  .addNode("approval", createAgentNode("approval", approvalNode))
  .addNode("retrieve", createAgentNode("retrieve", retrieveNode))
  .addNode("tool", createAgentNode("tool", toolNode))
  .addNode("generate", createAgentNode("generate", generateNode))
  .addNode("evaluate", createAgentNode("evaluate", evaluateNode))
  .addNode("error", createAgentNode("error", errorNode))
  .addEdge(START, "prepareContext")
  .addConditionalEdges("prepareContext", routeAfterPrepareContext, [
    "planStep",
    "error",
  ])
  .addConditionalEdges("planStep", routeAfterPlanStep, [
    "policyStep",
    "toolSelectStep",
    "error",
  ])
  .addConditionalEdges("toolSelectStep", routeAfterToolSelect, [
    "toolGuardStep",
    "error",
  ])
  .addConditionalEdges("toolGuardStep", routeAfterToolGuard, [
    "nextActionPlanner",
    "error",
  ])
  .addConditionalEdges("nextActionPlanner", routeAfterNextAction, [
    "generate",
    "retrieve",
    "toolCallNormalize",
    "error",
  ])
  .addConditionalEdges("toolCallNormalize", routeAfterToolCallNormalize, [
    "nextActionPlanner",
    "generate",
    "policyStep",
    "error",
  ])
  .addConditionalEdges("policyStep", routeAfterPolicy, [
    "approval",
    "tool",
    "generate",
    "error",
  ])
  .addConditionalEdges("approval", routeAfterApproval, [END, "error"])
  .addConditionalEdges("retrieve", routeAfterRetrieve, [
    "toolSelectStep",
    "generate",
    "error",
  ])
  .addConditionalEdges("tool", routeAfterTool, [
    "approval",
    "generate",
    "toolSelectStep",
    "error",
  ])
  .addConditionalEdges("generate", routeAfterGenerate, ["evaluate", "error"])
  .addConditionalEdges("evaluate", routeAfterEvaluate, [END, "error"])
  .addEdge("error", END)
  .compile();
