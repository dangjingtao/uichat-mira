// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import {
  ChatRuntime,
  createChatRuntimeStore,
  UChatApplicationStateProvider,
  useUChatRuntime,
  useUChatSelector,
} from "@/shared/uchat";

type TestRuntime = ChatRuntime & { testId: string };

const createTestRuntime = (testId: string): TestRuntime =>
  ({
    testId,
    store: createChatRuntimeStore(),
  }) as TestRuntime;

function RuntimeIdentityProbe() {
  const runtime = useUChatRuntime() as TestRuntime;
  return <div data-testid="runtime-id">{runtime.testId}</div>;
}

test("UChat public API keeps one runtime for the same application session", () => {
  const createRuntime = vi.fn(() => createTestRuntime("runtime-1"));
  const { rerender } = render(
    <UChatApplicationStateProvider
      sessionKey="user-1"
      createRuntime={createRuntime}
    >
      <RuntimeIdentityProbe />
    </UChatApplicationStateProvider>,
  );

  rerender(
    <UChatApplicationStateProvider
      sessionKey="user-1"
      createRuntime={createRuntime}
    >
      <RuntimeIdentityProbe />
    </UChatApplicationStateProvider>,
  );

  expect(screen.getByTestId("runtime-id")).toHaveTextContent("runtime-1");
  expect(createRuntime).toHaveBeenCalledTimes(1);
});

test("UChat public API replaces and disposes runtime state when the session changes", () => {
  const runtime1 = createTestRuntime("runtime-1");
  const runtime2 = createTestRuntime("runtime-2");
  const createRuntime = vi
    .fn<() => ChatRuntime>()
    .mockReturnValueOnce(runtime1)
    .mockReturnValueOnce(runtime2);
  const disposeRuntime = vi.fn();
  const { rerender } = render(
    <UChatApplicationStateProvider
      sessionKey="user-1"
      createRuntime={createRuntime}
      disposeRuntime={disposeRuntime}
    >
      <RuntimeIdentityProbe />
    </UChatApplicationStateProvider>,
  );

  rerender(
    <UChatApplicationStateProvider
      sessionKey="user-2"
      createRuntime={createRuntime}
      disposeRuntime={disposeRuntime}
    >
      <RuntimeIdentityProbe />
    </UChatApplicationStateProvider>,
  );

  expect(screen.getByTestId("runtime-id")).toHaveTextContent("runtime-2");
  expect(createRuntime).toHaveBeenCalledTimes(2);
  expect(disposeRuntime).toHaveBeenCalledWith(runtime1);
});

test("external store updates rerender selectors without rerendering non-subscribers", () => {
  const runtime = createTestRuntime("runtime-1");
  let settingsRenderCount = 0;

  function SettingsSurface() {
    settingsRenderCount += 1;
    return <div>settings</div>;
  }

  function RunStatus() {
    const status = useUChatSelector((state) => state.runStatus.type);
    return <div data-testid="run-status">{status}</div>;
  }

  render(
    <UChatApplicationStateProvider
      sessionKey="user-1"
      createRuntime={() => runtime}
    >
      <SettingsSurface />
      <RunStatus />
    </UChatApplicationStateProvider>,
  );

  act(() => {
    runtime.store.getState().setRunStatus({ type: "running" });
  });

  expect(screen.getByTestId("run-status")).toHaveTextContent("running");
  expect(settingsRenderCount).toBe(1);
});
