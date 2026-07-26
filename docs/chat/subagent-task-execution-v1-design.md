# Generic subAgent Task Execution V1

## 1. Goal

Let Main Planner focus on task planning, task selection and result acceptance.
A generic subAgent owns the local execution loop for one bounded, independently verifiable task:

```text
Main Planner
  -> delegate_task(TaskSpec)
  -> generic subAgent: plan / use tools / observe / repair
  -> structured TaskResult + Evidence / Artifact
  -> Main Planner: accept, replan or finish
```

The unit of delegation is a task package, not one tool call.

## 2. Reuse, do not rebuild

V1 reuses the existing forked Skill subAgent execution core:

- Pi agent runtime
- Harness tool adapters
- exact-invocation approval
- serialized checkpoint resume
- runtime trace and working-state events
- structured terminal result statuses

The generic task path creates an ephemeral execution instruction from Planner's `TaskSpec`; it does not require a new persisted Skill package or a new tool registry.

## 3. Hard boundaries

### 3.1 Main Agent contract remains unchanged

Do not redesign the existing recoverable / terminal C contract:

- recoverable execution failure returns Evidence to Planner for recovery;
- recovery exhaustion may enter guarded Generate;
- terminal failure sets graph failure and Generate does not run;
- approval remains Parent-governed and resumes the exact frozen invocation.

Existing Skill-owned subAgent completion remains a frozen delivery handoff. Generic task completion is different: it returns to Main Planner for task acceptance and the next decision.

### 3.2 One generic worker, no agent zoo

V1 has one generic task subAgent runtime.

- no subAgent profiles by business keyword;
- no recursive delegation (`maxDepth = 1`);
- no parallel workers;
- no model-selected agent class;
- no new Main Planner graph redesign.

### 3.3 No regex routing and no business hard-coding

Planner emits a structured `delegate_task` action.
Runtime validates fields by object shape and enum values.
Runtime must not infer delegation, completion or failure from natural-language keyword matching.

Fixed protocol fields are allowed and required; hard-coded business mappings are not.

### 3.4 Harness remains the tool truth source

At dispatch time, the generic subAgent receives the current governed `ToolExposure` snapshot.
Its available Harness tools are derived from that snapshot, not from a static code list.

The generic worker cannot register tools, widen permissions or bypass Policy.
It must not receive a generic delegation tool, preventing recursive subAgent creation.

V1 refresh boundary: ToolExposure is resolved by Main runtime before each delegated task. A running task keeps its frozen tool surface so prompt/tool schemas do not mutate mid-run. A later Planner decision receives the refreshed Harness exposure.

## 4. Protocol

### 4.1 Planner action

```ts
type DelegateTaskAction = {
  type: "delegate_task";
  task: {
    goal: string;
    acceptanceCriteria: string[];
  };
  reason: string;
};
```

Validation rules:

- `goal` is non-empty;
- `acceptanceCriteria` contains 1-8 non-empty items;
- extra fields are ignored only by the existing structured-output compatibility layer; invalid required fields enter the existing schema-replan path.

### 4.2 Runtime result

Reuse the existing subAgent statuses:

- `completed`
- `insufficient_evidence`
- `needs_input`
- `failed` with `recoverable`

Mapping to Main Agent:

| subAgent result | Main behavior |
| --- | --- |
| completed | commit observation/evidence, return to Planner |
| insufficient_evidence | commit partial evidence, return to Planner |
| needs_input | commit partial evidence, Parent asks the structured question |
| failed + recoverable | commit failed observation, return to Planner recovery |
| failed + terminal | commit blocked observation, enter existing error path |
| approval requirement | freeze exact invocation + checkpoint, Parent approval, resume same worker transcript |

## 5. Runtime construction

The task worker uses an ephemeral Skill-shaped execution context only as an adapter to the existing Pi subAgent core:

- id: runtime-owned constant identifying generic task execution, not a business type;
- body: generic worker rules plus TaskSpec goal and acceptance criteria;
- execution.allowedTools: current exposed Harness tool ids;
- resources/runtime bindings: empty;
- workspace binding: inherited from the current run context and enforced by individual Harness tools.

This adapter is not persisted as a user Skill and is not discoverable by Skill matching.

## 6. Graph integration

Add one node and one action route:

```text
nextActionPlanner
  -> delegateTask
  -> evidenceStage
  -> nextActionPlanner
```

Special boundaries:

- approval pauses from `delegateTask` through the existing approval node;
- resumed generic checkpoints are detected in PrepareContext and re-enter `delegateTask` without asking Planner to recreate the task;
- `needs_input` is frozen as Parent `ask_user` after evidence commit;
- generic completion never creates a finalization packet by itself.

## 7. Trace

Expose the existing subAgent trace under a generic task id and include:

- delegated goal preview;
- acceptance criteria count;
- frozen exposed tool ids;
- status;
- tool calls;
- artifact/evidence counts;
- approval resume marker.

Do not expose hidden chain-of-thought.

## 8. V1 acceptance criteria

1. Planner parser and validator accept valid `delegate_task` and reject malformed task packets through the existing structured replan contract.
2. Graph routes `delegate_task` to the generic node.
3. Generic node executes with the current dynamic Harness exposure and cannot delegate recursively.
4. Completed result is committed as Evidence and Planner runs again.
5. `needs_input` reaches Parent `ask_user` without Main Planner taking over local execution.
6. Approval freezes exact invocation plus checkpoint and resumes the same transcript.
7. Recoverable and terminal results preserve the current C contract.
8. Existing Skill subAgent tests and existing Planner/tool paths remain valid.
9. New focused tests cover parser/validation, routing, dynamic tool surface, completion, needs-input and approval resume.

## 9. Explicitly out of scope

- concurrent task workers;
- recursive subAgents;
- persistent generic subAgent sessions outside approval resume;
- automatic business-specific agent selection;
- changing Skill Agent completion semantics;
- changing Harness registry, Policy or Evidence schemas;
- replacing LangGraph or the current Planner task-plan contract.
