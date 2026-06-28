import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCcw } from "lucide-react";
import Alert from "@/shared/ui/Alert";
import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";
import { Select, TextArea, TextInput } from "@/shared/ui";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import { message } from "@/shared/ui/Message";
import { ApiError } from "@/shared/lib/request";
import { listKnowledgeBases, type KnowledgeBaseSummary } from "@/shared/api/knowledgeBase";
import {
  getIntegrationCapabilityStatus,
  getIntegrationInstances,
  sendWecomRobotCapabilityTestMessage,
  updateIntegrationCapability,
  updateIntegrationInstance,
  type IntegrationCapabilityRecord,
  type IntegrationCapabilityStatus,
  type IntegrationInstanceRecord,
} from "@/shared/api/integrations";

type InstanceDraft = {
  id: string;
  name: string;
  externalTenantId: string;
  configJson: string;
  enabled: boolean;
};

type CapabilityDraft = {
  id: string;
  instanceId: string;
  type: string;
  name: string;
  enabled: boolean;
  knowledgeBaseId: string;
  configJson: string;
  replyMode: "stream" | "send";
};

const prettyJson = (value: Record<string, unknown>) =>
  JSON.stringify(value ?? {}, null, 2);

const parseJsonObject = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON 必须是对象");
  }
  return parsed as Record<string, unknown>;
};

const statusTone = (status?: IntegrationCapabilityStatus["status"]) => {
  if (status === "connected") return "success";
  if (status === "error") return "danger";
  if (status === "connecting") return "warning";
  return "muted";
};

const statusDotClass = (status?: IntegrationCapabilityStatus["status"]) => {
  if (status === "connected") return "bg-success";
  if (status === "error") return "bg-danger";
  if (status === "connecting") return "bg-warning";
  return "bg-text-tertiary";
};

export default function IntegrationsSettings() {
  const { t } = useTranslation();
  const [instances, setInstances] = useState<IntegrationInstanceRecord[]>([]);
  const [capabilities, setCapabilities] = useState<IntegrationCapabilityRecord[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseSummary[]>([]);
  const [statuses, setStatuses] = useState<Record<string, IntegrationCapabilityStatus | null>>({});
  const [activeInstanceId, setActiveInstanceId] = useState<string>("");
  const [activeCapabilityId, setActiveCapabilityId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingCapabilityId, setTestingCapabilityId] = useState<string>("");
  const [testMessage, setTestMessage] = useState("这是一条企业微信测试消息。");
  const [testFormat, setTestFormat] = useState<"markdown" | "text">("markdown");
  const [mentionAll, setMentionAll] = useState(false);
  const [instanceDraft, setInstanceDraft] = useState<InstanceDraft | null>(null);
  const [capabilityDraft, setCapabilityDraft] = useState<CapabilityDraft | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [instanceResult, kbResult] = await Promise.all([
        getIntegrationInstances({ provider: "wecom", includeCapabilities: true }),
        listKnowledgeBases(),
      ]);

      const nextInstances = instanceResult.instances;
      const nextCapabilities = nextInstances.flatMap((item) => item.capabilities ?? []).filter(Boolean);

      setInstances(nextInstances);
      setCapabilities(nextCapabilities);
      setKnowledgeBases(kbResult);

      const nextInstance = nextInstances[0] ?? null;
      const nextCapability =
        nextCapabilities.find((item) => item.instanceId === nextInstance?.id) ??
        nextCapabilities[0] ??
        null;

      setActiveInstanceId(nextInstance?.id ?? "");
      setActiveCapabilityId(nextCapability?.id ?? "");
      setInstanceDraft(
        nextInstance
          ? {
              id: nextInstance.id,
              name: nextInstance.name,
              externalTenantId: nextInstance.externalTenantId ?? "",
              configJson: prettyJson(nextInstance.config),
              enabled: nextInstance.enabled,
            }
          : null,
      );
      setCapabilityDraft(
        nextCapability
          ? {
              id: nextCapability.id,
              instanceId: nextCapability.instanceId,
              type: nextCapability.type,
              name: nextCapability.name,
              enabled: nextCapability.enabled,
              knowledgeBaseId: nextCapability.knowledgeBaseId ?? "",
              configJson: prettyJson(nextCapability.config),
              replyMode: (nextCapability.config as Record<string, unknown>).replyMode === "send" ? "send" : "stream",
            }
          : null,
      );

      const nextStatuses = Object.fromEntries(
        await Promise.all(
          nextCapabilities.map(async (capability) => {
            try {
              return [capability.id, await getIntegrationCapabilityStatus(capability.id)] as const;
            } catch {
              return [capability.id, null] as const;
            }
          }),
        ),
      );
      setStatuses(nextStatuses);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("settings.integrations.messages.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  function openInstanceModal(instance: IntegrationInstanceRecord) {
    setActiveInstanceId(instance.id);
    setInstanceDraft({
      id: instance.id,
      name: instance.name,
      externalTenantId: instance.externalTenantId ?? "",
      configJson: prettyJson(instance.config),
      enabled: instance.enabled,
    });

    const nextCapability = capabilities.find((item) => item.instanceId === instance.id) ?? null;
    setActiveCapabilityId(nextCapability?.id ?? "");
    setCapabilityDraft(
      nextCapability
        ? {
            id: nextCapability.id,
            instanceId: nextCapability.instanceId,
            type: nextCapability.type,
            name: nextCapability.name,
            enabled: nextCapability.enabled,
            knowledgeBaseId: nextCapability.knowledgeBaseId ?? "",
            configJson: prettyJson(nextCapability.config),
            replyMode: (nextCapability.config as Record<string, unknown>).replyMode === "send" ? "send" : "stream",
          }
        : null,
    );
    setModalOpen(true);
  }

  const activeInstance = instances.find((item) => item.id === activeInstanceId) ?? null;
  const activeCapability = capabilities.find((item) => item.id === activeCapabilityId) ?? null;

  const saveInstance = async () => {
    if (!instanceDraft) return;
    setSaving(true);
    try {
      await updateIntegrationInstance(instanceDraft.id, {
        name: instanceDraft.name,
        externalTenantId: instanceDraft.externalTenantId.trim() || null,
        config: parseJsonObject(instanceDraft.configJson),
        enabled: instanceDraft.enabled,
      });
      message.success(t("settings.integrations.messages.instanceSaved"));
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("settings.integrations.messages.instanceSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const saveCapability = async () => {
    if (!capabilityDraft) return;
    setSaving(true);
    try {
      const config = parseJsonObject(capabilityDraft.configJson);
      if (capabilityDraft.type === "wecom.smart_robot") {
        config.replyMode = capabilityDraft.replyMode;
        if (capabilityDraft.knowledgeBaseId) {
          config.knowledgeBaseId = capabilityDraft.knowledgeBaseId;
        }
      }
      await updateIntegrationCapability(capabilityDraft.id, {
        name: capabilityDraft.name,
        enabled: capabilityDraft.enabled,
        knowledgeBaseId: capabilityDraft.knowledgeBaseId.trim() || null,
        config,
      });
      message.success(t("settings.integrations.messages.capabilitySaved"));
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t("settings.integrations.messages.capabilitySaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!activeCapability) return;
    setTestingCapabilityId(activeCapability.id);
    try {
      await sendWecomRobotCapabilityTestMessage(activeCapability.id, {
        content: testMessage,
        format: testFormat,
        mentionAll,
      });
      message.success(t("settings.wecom.messages.testMessageSent"));
    } catch (error) {
      message.error(error instanceof ApiError ? error.message : t("settings.wecom.messages.testMessageFailed"));
    } finally {
      setTestingCapabilityId("");
    }
  };

  return (
    <SettingsPageLayout
      miniTitle={t("settings.integrations.page.miniTitle")}
      title={t("settings.integrations.page.title")}
      description={t("settings.integrations.page.description")}
      slot={
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("settings.integrations.actions.refresh")}
        </Button>
      }
      contentClassName="space-y-4 pt-6"
    >
      {instances.length === 0 ? (
        <Alert variant="info" title={t("settings.integrations.empty.title")}>
          {t("settings.integrations.empty.description")}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {instances.map((instance) => {
          const instanceCapabilities = capabilities.filter((item) => item.instanceId === instance.id);
          return (
            <Card key={instance.id} variant="default" className="overflow-hidden p-0">
              <button
                type="button"
                onClick={() => openInstanceModal(instance)}
                className="flex aspect-[4/3] w-full flex-col justify-between p-4 text-left transition-colors hover:bg-surface-secondary/50"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.12em] text-text-tertiary">企业微信</div>
                      <div className="mt-1 truncate text-lg font-semibold text-text-primary">
                        {instance.name || t("settings.integrations.instance.unnamed")}
                      </div>
                    </div>
                    <Badge variant={instance.enabled ? "success" : "muted"} size="sm">
                      {instance.enabled ? "在线" : "停用"}
                    </Badge>
                  </div>
                  <div className="text-sm text-text-secondary">
                    {instance.externalTenantId || "未填写外部租户 ID"}
                  </div>
                </div>

                <div className="space-y-2">
                  {instanceCapabilities.slice(0, 2).map((capability) => {
                    const status = statuses[capability.id]?.status;
                    return (
                      <div
                        key={capability.id}
                        className="flex items-center justify-between gap-3 border-t border-border/60 pt-2 first:border-t-0 first:pt-0"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass(status)}`} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-text-primary">{capability.name || capability.type}</div>
                            <div className="truncate text-xs text-text-tertiary">{capability.knowledgeBaseId || "未绑定知识库"}</div>
                          </div>
                        </div>
                        <Badge variant={statusTone(status)} size="sm" className="shrink-0">
                          {status ?? "idle"}
                        </Badge>
                      </div>
                    );
                  })}
                  <Button variant="outline" size="sm" className="w-full justify-center">
                    调试
                  </Button>
                </div>
              </button>
            </Card>
          );
        })}
      </div>

      <Modal
        open={modalOpen}
        title={activeInstance ? `${activeInstance.name || t("settings.integrations.instance.unnamed")}` : t("settings.integrations.page.title")}
        width={980}
        maxHeight="calc(100vh - 2rem)"
        onClose={() => setModalOpen(false)}
        footer={null}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {instanceDraft ? (
              <Card variant="subtle" className="space-y-3">
                <div className="text-sm font-semibold text-text-primary">实例配置</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <TextInput
                    label="实例名称"
                    value={instanceDraft.name}
                    onChange={(value) =>
                      setInstanceDraft((current) => (current ? { ...current, name: value } : current))
                    }
                    disabled={saving}
                  />
                  <TextInput
                    label="外部租户 ID"
                    value={instanceDraft.externalTenantId}
                    onChange={(value) =>
                      setInstanceDraft((current) => (current ? { ...current, externalTenantId: value } : current))
                    }
                    disabled={saving}
                  />
                </div>
                <TextArea
                  label="实例配置 JSON"
                  value={instanceDraft.configJson}
                  onChange={(value) =>
                    setInstanceDraft((current) => (current ? { ...current, configJson: value } : current))
                  }
                  rows={6}
                  disabled={saving}
                />
                <div className="flex items-center gap-4 text-sm text-text-secondary">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={instanceDraft.enabled}
                      onChange={(e) =>
                        setInstanceDraft((current) => (current ? { ...current, enabled: e.target.checked } : current))
                      }
                    />
                    启用实例
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button variant="secondary" onClick={() => void saveInstance()} disabled={saving}>
                    保存实例
                  </Button>
                </div>
              </Card>
            ) : null}

            {capabilityDraft ? (
              <Card variant="subtle" className="space-y-3">
                <div className="text-sm font-semibold text-text-primary">能力配置</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <TextInput
                    label="能力名称"
                    value={capabilityDraft.name}
                    onChange={(value) =>
                      setCapabilityDraft((current) => (current ? { ...current, name: value } : current))
                    }
                    disabled={saving}
                  />
                  <TextInput label="能力类型" value={capabilityDraft.type} onChange={() => {}} disabled />
                  <Select
                    label="知识库"
                    value={capabilityDraft.knowledgeBaseId}
                    onChange={(value) =>
                      setCapabilityDraft((current) => (current ? { ...current, knowledgeBaseId: value } : current))
                    }
                    options={[
                      { value: "", label: "不绑定知识库" },
                      ...knowledgeBases.map((item) => ({ value: item.id, label: item.name })),
                    ]}
                    disabled={saving}
                  />
                  <Select
                    label="回复模式"
                    value={capabilityDraft.replyMode}
                    onChange={(value) =>
                      setCapabilityDraft((current) =>
                        current ? { ...current, replyMode: value === "send" ? "send" : "stream" } : current,
                      )
                    }
                    options={[
                      { value: "stream", label: "stream" },
                      { value: "send", label: "send" },
                    ]}
                    disabled={saving}
                  />
                </div>
                <TextArea
                  label="能力配置 JSON"
                  value={capabilityDraft.configJson}
                  onChange={(value) =>
                    setCapabilityDraft((current) => (current ? { ...current, configJson: value } : current))
                  }
                  rows={7}
                  disabled={saving}
                />
                <div className="space-y-2">
                  <div className="text-xs font-medium text-text-secondary">Secret</div>
                  <div className="rounded-ui-control border border-border bg-surface-secondary px-3 py-2 text-sm text-text-tertiary">
                    ••••••••
                  </div>
                </div>
                <div className="flex justify-between gap-2">
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => void saveCapability()} disabled={saving}>
                      保存能力
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void sendTest()}
                      disabled={testingCapabilityId === activeCapabilityId || !activeCapability}
                    >
                      调试
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>

          <Card variant="subtle" className="space-y-4">
            <div className="text-sm font-semibold text-text-primary">测试消息</div>
            <TextArea
              label="消息内容"
              value={testMessage}
              onChange={setTestMessage}
              rows={8}
              disabled={testingCapabilityId === activeCapabilityId}
            />
            <Select
              label="消息格式"
              value={testFormat}
              onChange={(value) => setTestFormat(value === "text" ? "text" : "markdown")}
              options={[
                { value: "markdown", label: "markdown" },
                { value: "text", label: "text" },
              ]}
            />
            <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={mentionAll} onChange={(e) => setMentionAll(e.target.checked)} />
              提醒 @all
            </label>
            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={() => void sendTest()}
                disabled={testingCapabilityId === activeCapabilityId || !activeCapability}
              >
                发送测试消息
              </Button>
            </div>
          </Card>
        </div>
      </Modal>
    </SettingsPageLayout>
  );
}
