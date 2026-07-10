import { END, START, StateGraph } from "@langchain/langgraph";
import {
  evaluateNode,
  approvalNode,
  errorNode,
  generateNode,
  nextActionPlannerNode,
  policyNode,
  prepareContextNode,
  retrieveNode,
  toolCallNormalizeNode,
  toolNode,
} from "../nodes/index";
import { AgentGraphStateAnnotation, createAgentNode } from "./state";
import {
  routeAfterApproval,
  routeAfterEvaluate,
  routeAfterGenerate,
  routeAfterNextAction,
  routeAfterPolicy,
  routeAfterPrepareContext,
  routeAfterRetrieve,
  routeAfterTool,
  routeAfterToolCallNormalize,
} from "./routes";

export const compiledAgentStateGraph = new StateGraph(AgentGraphStateAnnotation)
  .addNode(
    "prepareContext",
    createAgentNode("prepareContext", prepareContextNode),
  )
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
    "nextActionPlanner",
    "policyStep",
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
    "nextActionPlanner",
    "generate",
    "error",
  ])
  .addConditionalEdges("tool", routeAfterTool, [
    "approval",
    "generate",
    "nextActionPlanner",
    "error",
  ])
  .addConditionalEdges("generate", routeAfterGenerate, ["evaluate", "error"])
  .addConditionalEdges("evaluate", routeAfterEvaluate, [END, "error"])
  .addEdge("error", END)
  .compile();
