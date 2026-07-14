import { useCallback, useState } from "react";
import {
  approveComputerUseSession, assertComputerUseSession, createComputerUseSession, executeComputerUseAction, getComputerUseDebuggerStatus, observeComputerUseSession, rejectComputerUseSession, stopComputerUseSession,
  type ComputerUseActionInput, type ComputerUseDebuggerStatus, type ComputerUseModelState, type ComputerUseSession, type ComputerUseSessionConfig, type ComputerUseAssertionInput,
} from "@/shared/api/computerUse";

const initialConfig: ComputerUseSessionConfig = { runtime: "managed", url: "https://example.com", allowedDomains: ["example.com"], limits: { timeoutMs: 30000, maxSnapshotChars: 12000 }, approvalPolicy: "write_actions" };
const unavailableModel: ComputerUseModelState = { status: "unavailable", message: "T120 model and MCP invocation API is not available yet. Manual Debug remains available.", checkedAt: new Date(0).toISOString() };
const unavailableStatus: ComputerUseDebuggerStatus = { runtime: { status: "not_installed", message: "Browser runtime status is not available.", checkedAt: new Date(0).toISOString() }, model: unavailableModel };
const defaultApi: ComputerUseDebuggerApi = {};

export type ComputerUseDebuggerApi = Partial<Pick<typeof import("@/shared/api/computerUse"), "getComputerUseDebuggerStatus" | "createComputerUseSession" | "observeComputerUseSession" | "executeComputerUseAction" | "assertComputerUseSession" | "approveComputerUseSession" | "rejectComputerUseSession" | "stopComputerUseSession">>;
export function useComputerUseDebuggerState(api: ComputerUseDebuggerApi = defaultApi) {
  const [config, setConfigState] = useState(initialConfig); const [status, setStatus] = useState(unavailableStatus); const [session, setSession] = useState<ComputerUseSession>(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  const call = useCallback(async <T,>(fn: () => Promise<T>, next: (value: T) => void) => { setBusy(true); setError(undefined); try { next(await fn()); } catch (err) { setError(err instanceof Error ? err.message : "Request failed"); } finally { setBusy(false); } }, []);
  const refreshStatus = useCallback(async () => { try { setStatus(await (api.getComputerUseDebuggerStatus ?? getComputerUseDebuggerStatus)()); } catch { setStatus(unavailableStatus); } }, [api]);
  const setConfig = (patch: Partial<ComputerUseSessionConfig>) => setConfigState((value) => ({ ...value, ...patch }));
  const newSession = () => call(() => (api.createComputerUseSession ?? createComputerUseSession)(config), setSession);
  const observe = () => session && call(() => (api.observeComputerUseSession ?? observeComputerUseSession)(session.sessionId), setSession);
  const executeAction = (input: ComputerUseActionInput) => session && call(() => (api.executeComputerUseAction ?? executeComputerUseAction)(session.sessionId, input), setSession);
  const assertState = (input: ComputerUseAssertionInput) => session && call(() => (api.assertComputerUseSession ?? assertComputerUseSession)(session.sessionId, input), setSession);
  const approve = () => session?.approval?.invocationId && call(() => (api.approveComputerUseSession ?? approveComputerUseSession)(session.sessionId, session.approval!.invocationId!), setSession);
  const reject = () => session?.approval?.invocationId && call(() => (api.rejectComputerUseSession ?? rejectComputerUseSession)(session.sessionId, session.approval!.invocationId!), setSession);
  const stop = () => session && call(() => (api.stopComputerUseSession ?? stopComputerUseSession)(session.sessionId), setSession);
  return { config, setConfig, status, runtime: status.runtime, model: status.model, session, busy, error, refreshStatus, newSession, observe, executeAction, assertState, approve, reject, stop, reset: () => { setSession(undefined); setError(undefined); setConfigState(initialConfig); } };
}
