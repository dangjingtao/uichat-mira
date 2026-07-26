// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ToolsTracePanel from "./ToolsTracePanel";

describe("ToolsTracePanel", () => {
  it("keeps approval events and trace visible while awaiting approval", () => {
    render(
      <ToolsTracePanel
        activeToolId="github_issue"
        artifacts={[]}
        events={[
          {
            type: "invocation:start",
            invocationId: "inv-1",
            toolId: "github_issue",
            at: "2026-07-26T06:30:00.000Z",
          },
          {
            type: "invocation:approval_required",
            invocationId: "inv-1",
            message: "Approval required",
            scope: "github.remote_write",
            at: "2026-07-26T06:30:01.000Z",
          },
          {
            type: "invocation:finish",
            invocationId: "inv-1",
            status: "awaiting_approval",
            at: "2026-07-26T06:30:02.000Z",
          },
        ]}
        emptyPlaceholder="No activity"
        panelTitle="Execution trace"
        runError="Approval required"
        runStatus="awaiting_approval"
        trace={{
          traceId: "trace-1",
          invocationId: "inv-1",
          toolId: "github_issue",
          startedAt: "2026-07-26T06:30:00.000Z",
          finishedAt: "2026-07-26T06:30:02.000Z",
          spans: [
            {
              id: "span-1",
              traceId: "trace-1",
              invocationId: "inv-1",
              name: "approval",
              kind: "permission_check",
              status: "completed",
              startedAt: "2026-07-26T06:30:00.000Z",
              finishedAt: "2026-07-26T06:30:01.000Z",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Approval required")).toBeInTheDocument();
    expect(screen.getByText("trace-1")).toBeInTheDocument();
    expect(
      screen.getByText(/approval\s+Approval required\s+\[github\.remote_write\]/u),
    ).toBeInTheDocument();
    expect(screen.getByText(/permission_check\s+approval\s+completed/u)).toBeInTheDocument();
  });
});
