import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  approveComputerUseSession, assertComputerUseSession, createComputerUseSession, executeComputerUseAction, getComputerUseDebuggerStatus, observeComputerUseSession, rejectComputerUseSession, stopComputerUseSession,
  runComputerUseTask, type ComputerUseActionInput, type ComputerUseDebuggerStatus, type ComputerUseModelState, type ComputerUseSession, type ComputerUseSessionConfig, type ComputerUseAssertionInput, type ComputerUseTaskRun,
} from "@/shared/api/computerUse";

const initialConfig: ComputerUseSessionConfig = { runtime: "managed", url: "https://example.com", allowedDomains: ["example.com"], limits: { timeoutMs: 30000, maxSnapshotChars: 12000 }, approvalPolicy: "write_actions" };
const unavailableModel: ComputerUseModelState = { status: "unavailable", message: "T120 model and MCP invocation API is not available yet. Manual Debug remains available.", checkedAt: new Date(0).toISOString() };
const unavailableStatus: ComputerUseDebuggerStatus = { runtime: { status: "not_installed", message: "Browser runtime status is not available.", checkedAt: new Date(0).toISOString() }, model: unavailableModel };
const defaultApi: ComputerUseDebuggerApi = {};

export type ComputerUseDebuggerApi = Partial<Pick<typeof import("@/shared/api/computerUse"), "getComputerUseDebuggerStatus" | "createComputerUseSession" | "observeComputerUseSession" | "executeComputerUseAction" | "assertComputerUseSession" | "approveComputerUseSession" | "rejectComputerUseSession" | "stopComputerUseSession" | "runComputerUseTask">>;
export function useComputerUseDebuggerState(api: ComputerUseDebuggerApi = defaultApi) {
  const { t } = useTranslation();
  const [config, setConfigState] = useState(initialConfig); const [status, setStatus] = useState(unavailableStatus); const [session, setSession] = useState<ComputerUseSession>(); const [modelRun, setModelRun] = useState<ComputerUseTaskRun>(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  const call = useCallback(async <T,>(fn: () => Promise<T>, next: (value: T) => void) => { setBusy(true); setError(undefined); try { next(await fn()); } catch (err) { setError(err instanceof Error ? err.message : t("settings.microApps.computerUseDebugger.errors.requestFailed")); } finally { setBusy(false); } }, [t]);
  const refreshStatus = useCallback(async () => { try { setStatus(await (api.getComputerUseDebuggerStatus ?? getComputerUseDebuggerStatus)()); } catch { setStatus(unavailableStatus); } }, [api]);
  const setConfig = (patch: Partial<ComputerUseSessionConfig>) => setConfigState((value) => ({ ...value, ...patch }));
  const newSession = () => call(() => (api.createComputerUseSession ?? createComputerUseSession)(config), setSession);
  const observe = () => session && call(() => (api.observeComputerUseSession ?? observeComputerUseSession)(session.sessionId), setSession);
  const executeAction = (input: ComputerUseActionInput) => session && call(() => (api.executeComputerUseAction ?? executeComputerUseAction)(session.sessionId, input), setSession);
  const assertState = (input: ComputerUseAssertionInput) => session && call(() => (api.assertComputerUseSession ?? assertComputerUseSession)(session.sessionId, input), setSession);
  const approve = () => session?.approval?.invocationId && call(() => (api.approveComputerUseSession ?? approveComputerUseSession)(session.sessionId, session.approval!.invocationId!), setSession);
  const reject = () => session?.approval?.invocationId && call(() => (api.rejectComputerUseSession ?? rejectComputerUseSession)(session.sessionId, session.approval!.invocationId!), setSession);
  const stop = () => session && call(() => (api.stopComputerUseSession ?? stopComputerUseSession)(session.sessionId), setSession);
  const runModel = () => call(() => (api.runComputerUseTask ?? runComputerUseTask)({ goal: `Use the managed browser to inspect ${config.url} and report the page title.`, siteScope: [config.url] }), setModelRun);
  return { config, setConfig, status, runtime: status.runtime, model: status.model, session, modelRun, busy, error, refreshStatus, newSession, observe, executeAction, assertState, approve, reject, stop, runModel, reset: () => { setSession(undefined); setModelRun(undefined); setError(undefined); setConfigState(initialConfig); } };
}
