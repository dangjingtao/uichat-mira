import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, CircleStop, Eye, Play, Plus, RotateCcw } from "lucide-react";
import { Alert, Badge, Button, Card, Select, TextInput } from "@/shared/ui";
import { resolveComputerUseArtifactUrl, type ComputerUseActionInput, type ComputerUseAssertionInput } from "@/shared/api/computerUse";
import MicroAppPageLayout from "../components/MicroAppPageLayout";
import { useComputerUseDebuggerState, type ComputerUseDebuggerApi } from "./useComputerUseDebuggerState";

const actionNames = ["navigate", "click", "type", "select", "press", "scroll", "wait"];
const assertionNames = ["title", "url", "text", "visible", "value"];

export default function ComputerUseDebuggerPage({ api }: { api?: ComputerUseDebuggerApi }) {
  const { t } = useTranslation();
  const state = useComputerUseDebuggerState(api);
  const [tab, setTab] = useState<"feedback" | "json">("feedback");
  const [action, setAction] = useState("navigate");
  const [ref, setRef] = useState("");
  const [value, setValue] = useState("");
  const [assertion, setAssertion] = useState("title");
  const [expected, setExpected] = useState("");
  const browser = state.session?.browser;
  const config = state.config;
  const modelUnavailable = state.model.status === "unavailable";
  const rawJson = useMemo(() => JSON.stringify(state.session ?? state.status, null, 2), [state.session, state.status]);

  useEffect(() => { void state.refreshStatus(); }, [state.refreshStatus]);

  const runAction = () => {
    if (!browser?.url || !browser.snapshotHash) return;
    void state.executeAction(buildActionInput(action, ref, value, browser.url, browser.snapshotHash));
  };

  return (
    <MicroAppPageLayout
      miniTitle={t("settings.microApps.computerUseDebugger.page.miniTitle")}
      title={t("settings.microApps.computerUseDebugger.page.title")}
      description={t("settings.microApps.computerUseDebugger.page.description")}
      contentClassName="gap-4 pt-6"
      slot={<div className="flex flex-wrap gap-2"><Badge variant={state.runtime.status === "ready" ? "success" : "warning"}>{t(`settings.microApps.computerUseDebugger.runtime.${state.runtime.status}`)}</Badge><Badge variant={modelUnavailable ? "muted" : "success"}>{modelUnavailable ? t("settings.microApps.computerUseDebugger.model.unavailable") : t("settings.microApps.computerUseDebugger.model.connected")}</Badge></div>}
    >
      {modelUnavailable && <Alert variant="info" title={t("settings.microApps.computerUseDebugger.model.unavailableTitle")}>{state.model.message}</Alert>}
      {state.error && <Alert variant="danger" title={t("settings.microApps.computerUseDebugger.errors.title")}>{state.error}</Alert>}
      <div className="grid min-h-0 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <Card className="space-y-4" padding="md">
          <SectionTitle icon={<Activity className="h-4 w-4" />} title={t("settings.microApps.computerUseDebugger.runConfig.title")} />
          <Select label={t("settings.microApps.computerUseDebugger.runConfig.runtime")} value={config.runtime} onChange={(v) => state.setConfig({ runtime: v as "managed" | "system" })} options={[{ value: "managed", label: "Managed Chromium" }, { value: "system", label: "System browser" }]} />
          <TextInput label={t("settings.microApps.computerUseDebugger.runConfig.url")} value={config.url} onChange={(v) => state.setConfig({ url: v })} placeholder="https://example.com" />
          <TextInput label={t("settings.microApps.computerUseDebugger.runConfig.allowedDomains")} value={config.allowedDomains.join(", ")} onChange={(v) => state.setConfig({ allowedDomains: v.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="example.com" />
          <div className="grid grid-cols-2 gap-2 text-body-small text-text-secondary"><span>{t("settings.microApps.computerUseDebugger.runConfig.timeout")}: {config.limits.timeoutMs} ms</span><span>{t("settings.microApps.computerUseDebugger.runConfig.snapshot")}: {config.limits.maxSnapshotChars}</span></div>
          <Select label={t("settings.microApps.computerUseDebugger.runConfig.approvalPolicy")} value={config.approvalPolicy} onChange={(v) => state.setConfig({ approvalPolicy: v as typeof config.approvalPolicy })} options={[{ value: "always", label: "Always approve" }, { value: "write_actions", label: "Write actions" }, { value: "never", label: "Never" }]} />
          <div className="flex flex-wrap gap-2 border-t border-border pt-3"><Button size="sm" variant="primary" onClick={() => void state.newSession()}><Plus className="h-4 w-4" />{t("settings.microApps.computerUseDebugger.actions.newSession")}</Button><Button size="sm" variant="outline" onClick={() => state.reset()}><RotateCcw className="h-4 w-4" />{t("settings.microApps.computerUseDebugger.actions.reset")}</Button></div>
        </Card>
        <div className="space-y-4">
          <Card className="space-y-3"><SectionTitle icon={<Eye className="h-4 w-4" />} title={t("settings.microApps.computerUseDebugger.browserState.title")} /><div className="grid gap-2 text-body-small"><Field label="URL" value={browser?.url} /><Field label={t("settings.microApps.computerUseDebugger.browserState.titleLabel")} value={browser?.title} /><Field label="Snapshot hash" value={browser?.snapshotHash} /></div><pre className="max-h-48 overflow-auto rounded-ui-control bg-surface-secondary p-3 font-mono text-xs text-text-secondary">{browser?.snapshot || t("settings.microApps.computerUseDebugger.browserState.empty")}</pre><FeedbackBlock title={t("settings.microApps.computerUseDebugger.browserState.visibleText")} value={browser?.visibleText || "-"} />{browser?.screenshotArtifact ? <div><div className="text-caption uppercase text-text-tertiary">{t("settings.microApps.computerUseDebugger.browserState.screenshot")}</div><img src={resolveComputerUseArtifactUrl(browser.screenshotArtifact)} alt={t("settings.microApps.computerUseDebugger.browserState.screenshot")} className="mt-1 max-h-48 w-full object-contain" /></div> : null}<div className="flex gap-2"><Button size="sm" variant="secondary" disabled={!state.session || state.busy} onClick={() => void state.observe()}><Eye className="h-4 w-4" />{t("settings.microApps.computerUseDebugger.actions.inspect")}</Button><Button size="sm" variant="danger-ghost" disabled={!state.session || state.busy} onClick={() => void state.stop()}><CircleStop className="h-4 w-4" />{t("settings.microApps.computerUseDebugger.actions.stop")}</Button></div></Card>
          <Card className="space-y-3"><SectionTitle icon={<Play className="h-4 w-4" />} title={t("settings.microApps.computerUseDebugger.manual.title")} /><div className="grid gap-2 md:grid-cols-[150px_1fr_1fr_auto]"><Select label={t("settings.microApps.computerUseDebugger.manual.action")} value={action} onChange={setAction} options={actionNames.map((item) => ({ value: item, label: item }))} /><TextInput label={t("settings.microApps.computerUseDebugger.manual.ref")} value={ref} onChange={setRef} placeholder="element ref" /><TextInput label={t("settings.microApps.computerUseDebugger.manual.value")} value={value} onChange={setValue} placeholder="URL or value" /><Button className="self-end h-10" size="sm" variant="primary" disabled={!state.session || !browser?.url || !browser?.snapshotHash || state.busy} onClick={runAction}>{t("settings.microApps.computerUseDebugger.actions.execute")}</Button></div><div className="grid gap-2 md:grid-cols-[150px_1fr_auto]"><Select label={t("settings.microApps.computerUseDebugger.manual.assertion")} value={assertion} onChange={setAssertion} options={assertionNames.map((item) => ({ value: item, label: item }))} /><TextInput label={t("settings.microApps.computerUseDebugger.manual.expected")} value={expected} onChange={setExpected} placeholder="Expected value" /><Button className="self-end h-10" size="sm" variant="secondary" disabled={!state.session || state.busy} onClick={() => void state.assertState(buildAssertionInput(assertion, ref, expected))}>{t("settings.microApps.computerUseDebugger.actions.assert")}</Button></div></Card>
        </div>
        <Card className="flex min-h-[420px] flex-col gap-3"><div className="flex items-center justify-between"><SectionTitle title={t("settings.microApps.computerUseDebugger.feedback.title")} /><div className="flex gap-1"><Button size="xs" variant={tab === "feedback" ? "secondary" : "ghost"} onClick={() => setTab("feedback")}>{t("settings.microApps.computerUseDebugger.feedback.events")}</Button><Button size="xs" variant={tab === "json" ? "secondary" : "ghost"} onClick={() => setTab("json")}>JSON</Button></div></div>{tab === "json" ? <pre className="min-h-0 flex-1 overflow-auto rounded-ui-control bg-surface-secondary p-3 font-mono text-xs text-text-secondary">{rawJson}</pre> : <div className="min-h-0 flex-1 space-y-3 overflow-auto">{state.session?.approval ? <div><FeedbackBlock title="Approval" value={state.session.approval} />{state.session.approval.status === "pending" ? <div className="flex gap-2"><Button size="sm" variant="primary" onClick={() => void state.approve()} disabled={state.busy}>{t("settings.microApps.computerUseDebugger.actions.approve")}</Button><Button size="sm" variant="danger-ghost" onClick={() => void state.reject()} disabled={state.busy}>{t("settings.microApps.computerUseDebugger.actions.reject")}</Button></div> : null}</div> : null}{state.session?.invocations.length ? state.session.invocations.map((item) => <div key={item.invocationId} className="border-b border-border pb-3 text-body-small"><div className="flex justify-between"><strong className="text-text-primary">{item.tool}</strong><Badge variant={item.status === "failed" ? "danger" : item.status === "succeeded" ? "success" : item.status === "awaiting_approval" ? "warning" : "neutral"}>{item.status}</Badge></div><div className="font-mono text-xs text-text-tertiary">{item.invocationId}</div><FeedbackBlock title="Tool args" value={item.args} />{item.artifactIds?.length ? <FeedbackBlock title="Artifacts" value={item.artifactIds} /> : null}{item.error && <div className="text-danger-text">{item.error.code}: {item.error.message}</div>}</div>) : <div className="flex h-full items-center justify-center text-body-small text-text-tertiary">{t("settings.microApps.computerUseDebugger.feedback.empty")}</div>}{state.session?.evidence ? <FeedbackBlock title="Evidence" value={state.session.evidence} /> : null}{state.session?.result ? <FeedbackBlock title="Result" value={state.session.result} /> : null}</div>}<div className="border-t border-border pt-3"><div className="mb-2 text-caption uppercase text-text-tertiary">{t("settings.microApps.computerUseDebugger.modelRun.title")}</div><Button className="w-full" variant="secondary" disabled={modelUnavailable || !state.session}>{t("settings.microApps.computerUseDebugger.modelRun.run")}</Button></div></Card>
      </div>
    </MicroAppPageLayout>
  );
}

function SectionTitle({ icon, title }: { icon?: React.ReactNode; title: string }) { return <h2 className="flex items-center gap-2 text-heading-2 text-text-primary">{icon}{title}</h2>; }
function Field({ label, value }: { label: string; value?: string }) { return <div className="flex justify-between gap-3 border-b border-border pb-1"><span className="text-text-tertiary">{label}</span><span className="truncate font-mono text-text-primary">{value || "-"}</span></div>; }
function FeedbackBlock({ title, value }: { title: string; value: unknown }) { return <div className="mt-2"><div className="text-caption uppercase text-text-tertiary">{title}</div><pre className="mt-1 max-h-32 overflow-auto rounded-ui-control bg-surface-secondary p-2 font-mono text-xs text-text-secondary">{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre></div>; }

export function buildActionInput(action: string, ref: string, value: string, pageUrl: string, snapshotHash: string): ComputerUseActionInput {
  if (action === "navigate") return { pageUrl, snapshotHash, action: { kind: "navigate", url: value } };
  if (action === "click") return { pageUrl, snapshotHash, action: { kind: "click", ref } };
  if (action === "type") return { pageUrl, snapshotHash, action: { kind: "type", ref, text: value } };
  if (action === "select") return { pageUrl, snapshotHash, action: { kind: "select", ref, value } };
  if (action === "press") return { pageUrl, snapshotHash, action: { kind: "press", ref, key: value } };
  if (action === "scroll") return { pageUrl, snapshotHash, action: { kind: "scroll", y: Number(value) || 0 } };
  return { pageUrl, snapshotHash, action: { kind: "wait", timeoutMs: Number(value) || undefined } };
}

export function buildAssertionInput(assertion: string, ref: string, expected: string): ComputerUseAssertionInput {
  if (assertion === "visible") return { assertion: { kind: "visible", ref } };
  if (assertion === "value") return { assertion: { kind: "value", ref, expected } };
  return { assertion: { kind: assertion as "title" | "url" | "text", expected } };
}
