import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Archive,
  BookOpen,
  Check,
  CircleHelp,
  Database,
  Eye,
  EyeOff,
  FileText,
  Link2,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";
import Switch from "@/shared/ui/Switch";
import { AccessPointPreviewDrawer, Button, IconButton, Select, TextInput } from "@/shared/ui";
import { ModalShell } from "@/shared/ui/Modal";
import { message } from "@/shared/ui/Message";
import {
  createNotionAccessPoint,
  deleteNotionAccessPoint,
  getNotionAccessPointPreview,
  getNotionConnection,
  getNotionAccessPoints,
  saveNotionConnection,
  validateNotionConnection,
  validateNotionAccessPoint,
  type NotionAccessPoint,
  type AccessPointPreview,
  type NotionActivity,
  type NotionCapability,
  getNotionActivities,
} from "@/shared/api/notion";
import Drawer from "@/shared/ui/Drawer";
import MicroAppPageLayout from "../components/MicroAppPageLayout";
import NotionSetupDrawer from "./NotionSetupDrawer";
import Tooltip from "@/shared/ui/Tooltip";

const typeLabels: Record<NotionAccessPoint["type"], string> = {
  page_scope: "页面范围",
  database: "数据库",
  publish_target: "归档目标",
};

const actionLabels: Record<string, string> = {
  search: "搜索",
  read: "读取",
  query: "查询",
  create_page: "创建需确认",
  append_content: "追加需确认",
  create_record: "创建记录需确认",
  update_record: "更新需确认",
  sync_to_knowledge_base: "同步知识库需确认",
};

const activityLabels: Record<string, string> = {
  connection_validate: "连接验证",
  access_point_create: "添加接入点",
  access_point_validate: "验证接入点",
  access_point_delete: "删除接入点",
  database_query: "数据库查询",
  append_content: "追加内容",
  create_page: "创建页面",
  create_record: "创建记录",
  sync_to_knowledge_base: "同步到知识库",
};

const typeIcons = {
  page_scope: FileText,
  database: Database,
  publish_target: Archive,
};

export default function NotionMicroAppPage() {
  const { t } = useTranslation();
  const [accessPoints, setAccessPoints] = useState<NotionAccessPoint[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<NotionAccessPoint["type"] | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [connectionName, setConnectionName] = useState("Tomz Workspace");
  const [editingToken, setEditingToken] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [readOnly, setReadOnly] = useState(true);
  const [newPoint, setNewPoint] = useState({ name: "", type: "page_scope" as NotionAccessPoint["type"], resource: "" });
  const [newPointActions, setNewPointActions] = useState(["search", "read"]);
  const [connectionStatus, setConnectionStatus] = useState<"unconfigured" | "validating" | "connected" | "error" | "disabled">("unconfigured");
  const [workspaceName, setWorkspaceName] = useState("Notion Workspace");
  const [maskedToken, setMaskedToken] = useState("");
  const [connectionCapabilities, setConnectionCapabilities] = useState<NotionCapability[]>([]);
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [activities, setActivities] = useState<NotionActivity[]>([]);
  const [showActivities, setShowActivities] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<AccessPointPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    void getNotionConnection()
      .then(({ connection, capabilities }) => {
        setConnectionStatus(connection.status);
        setConnectionCapabilities(capabilities);
        setConnectionName(connection.name);
        setWorkspaceName(connection.workspaceName || "Notion Workspace");
        setMaskedToken(connection.maskedToken);
        setEnabled(connection.enabled);
        setReadOnly(connection.defaultReadOnly);
      })
      .catch((error) => message.error(error instanceof Error ? error.message : "加载 Notion 连接配置失败"))
      .finally(() => setLoadingConnection(false));
  }, []);

  useEffect(() => {
    void getNotionActivities()
      .then(({ activities: nextActivities }) => setActivities(nextActivities))
      .catch((error) => message.error(error instanceof Error ? error.message : "加载 Notion 最近活动失败"));
  }, []);

  useEffect(() => {
    void getNotionAccessPoints()
      .then(({ accessPoints: nextAccessPoints }) => setAccessPoints(nextAccessPoints))
      .catch((error) => message.error(error instanceof Error ? error.message : "加载 Notion 接入点失败"));
  }, []);

  const filteredAccessPoints = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return accessPoints.filter((point) => {
      const matchesType = filter === "all" || point.type === filter;
      const matchesQuery = !normalizedQuery || [point.name, point.resourceTitle, point.resourceId, typeLabels[point.type]]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
      return matchesType && matchesQuery;
    });
  }, [accessPoints, filter, query]);

  const notify = (text: string) => message.success(text);

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const result = await validateNotionConnection(editingToken ? tokenDraft : undefined);
      setConnectionStatus(result.connection.status);
      setConnectionCapabilities(result.capabilities);
      setWorkspaceName(result.connection.workspaceName || "Notion Workspace");
      setMaskedToken(result.connection.maskedToken);
      if (!editingToken) setTokenDraft("");
      notify("连接验证通过");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Notion 连接验证失败");
    } finally {
      setTestingConnection(false);
    }
  };

  const saveConnectionConfig = async () => {
    if (!connectionName.trim()) {
      message.warning("请填写连接名称");
      return;
    }
    if (editingToken && !tokenDraft.trim()) {
      message.warning("请输入新的 Integration Token");
      return;
    }
    setSavingConnection(true);
    try {
      const result = await saveNotionConnection({ name: connectionName.trim(), token: editingToken ? tokenDraft.trim() : undefined, enabled, defaultReadOnly: readOnly });
      setConnectionStatus(result.connection.status);
      setConnectionCapabilities(result.capabilities);
      setWorkspaceName(result.connection.workspaceName || "Notion Workspace");
      setMaskedToken(result.connection.maskedToken);
      setEditingToken(false);
      setTokenDraft("");
      notify("连接配置已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存 Notion 连接配置失败");
    } finally {
      setSavingConnection(false);
    }
  };

  const addAccessPoint = async () => {
    if (!newPoint.name.trim() || !newPoint.resource.trim()) {
      message.warning("请填写接入点名称和目标资源");
      return;
    }
    const resourceId = extractNotionResourceId(newPoint.resource.trim());
    if (!resourceId) {
      message.warning("请填写有效的 Notion 页面或数据库 ID / URL");
      return;
    }
    try {
      const result = await createNotionAccessPoint({ name: newPoint.name.trim(), type: newPoint.type, resourceId, resourceUrl: newPoint.resource.trim().startsWith("http") ? newPoint.resource.trim() : null, allowedActions: newPointActions });
      setAccessPoints((current) => [...current, result.accessPoint]);
      setNewPoint({ name: "", type: "page_scope", resource: "" });
      setNewPointActions(["search", "read"]);
      setShowAddModal(false);
      notify("接入点已验证并添加");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "添加接入点失败");
    }
  };

  const refreshAccessPoint = async (id: string) => {
    try {
      const result = await validateNotionAccessPoint(id);
      setAccessPoints((current) => current.map((point) => point.id === id ? result.accessPoint : point));
      notify("接入点验证完成");
    } catch (error) { message.error(error instanceof Error ? error.message : "验证接入点失败"); }
  };

  const removeAccessPoint = async (id: string) => {
    try {
      await deleteNotionAccessPoint(id);
      setAccessPoints((current) => current.filter((point) => point.id !== id));
      notify("接入点已删除");
    } catch (error) { message.error(error instanceof Error ? error.message : "删除接入点失败"); }
  };

  const previewAccessPoint = async (point: NotionAccessPoint) => {
    setShowPreview(true);
    setPreview(null);
    setPreviewError(null);
    setLoadingPreview(true);
    try {
      const result = await getNotionAccessPointPreview(point.id);
      setPreview(result.preview);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "加载接入点预览失败");
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <MicroAppPageLayout
      miniTitle={t("settings.microApps.page.miniTitle")}
      title="Notion"
      description="连接 Notion 工作区，为 Mira 提供页面检索、数据库查询、内容归档与知识库同步能力。"
      slot={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowSetupGuide(true)}>
            <BookOpen className="h-4 w-4" />
            接入说明
          </Button>
        </div>
      }
      contentClassName="space-y-5 pt-5"
    >
      <Card className="border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-ui-panel bg-surface-primary text-2xl font-semibold text-text-primary shadow-shadow-sm">N</div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-text-primary">{workspaceName}</h2>
              <Badge variant="muted">Internal Integration</Badge>
              <Badge variant={connectionStatus === "connected" ? "success" : connectionStatus === "error" ? "danger" : "muted"}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${connectionStatus === "connected" ? "bg-success" : connectionStatus === "error" ? "bg-danger" : "bg-border"}`} />{connectionStatus === "connected" ? "已连接" : connectionStatus === "disabled" ? "已停用" : connectionStatus === "error" ? "异常" : "未配置"}</Badge>
            </div>
            <p className="text-sm leading-6 text-text-secondary">一个授权实例可以服务多个接入点；每个接入点独立限制资源范围和允许动作。</p>
          </div>
          <div className="grid grid-cols-3 gap-4 border-t border-border pt-3 text-left md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <Metric label="授权范围" value={connectionStatus === "connected" ? "由接入点决定" : "尚未验证"} />
            <Metric label="能力状态" value={`${connectionCapabilities.filter((item) => item.status === "available").length} 项可用`} />
            <Metric label="最近校验" value={connectionStatus === "connected" ? "已记录" : "尚未校验"} />
          </div>
        </div>
      </Card>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card padding="none" className="order-2">
            <PanelHeader title="接入点" description="一个 Workspace 可以配置多个页面、数据库和写回目标.">
              <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}><Plus className="h-4 w-4" />添加接入点</Button>
            </PanelHeader>
            <div className="flex flex-col gap-2 border-b border-border bg-surface-secondary/30 p-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-icon-secondary" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索接入点名称或目标资源" className="h-9 w-full rounded-ui-control border border-border bg-surface-primary pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>
              <Select
                value={filter}
                onChange={(value) => setFilter(value as NotionAccessPoint["type"] | "all")}
                options={[{ value: "all", label: "全部类型" }, { value: "page_scope", label: "页面范围" }, { value: "database", label: "数据库" }, { value: "publish_target", label: "归档目标" }]}
                compact
              />
            </div>
            <div className="divide-y divide-border">
              {filteredAccessPoints.length === 0 ? <div className="p-8 text-center text-sm text-text-secondary">尚未配置接入点</div> : null}
              {filteredAccessPoints.map((point) => {
                const TypeIcon = typeIcons[point.type];
                return (
                  <div key={point.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(170px,1.3fr)_minmax(150px,1fr)_minmax(180px,1.1fr)_auto] lg:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ui-control bg-primary/10 text-primary"><TypeIcon className="h-4 w-4" /></span>
                      <div className="min-w-0"><div className="truncate text-sm font-medium text-text-primary">{point.name}</div><div className="mt-1 text-xs text-text-tertiary">{typeLabels[point.type]} · {point.type === "page_scope" ? "包含已授权子页面" : "项目状态源"}</div></div>
                    </div>
                    <ValueCell label="目标资源" value={point.resourceTitle || point.resourceId} />
                    <div><div className="mb-1.5 text-[11px] text-text-tertiary">允许动作</div><div className="flex flex-wrap gap-1.5">{point.allowedActions.map((action) => <Badge key={action} variant={action.includes("create") || action.includes("append") || action.includes("update") || action.includes("sync") ? "warning" : "neutral"}>{actionLabels[action] ?? action}</Badge>)}</div></div>
                    <div className="flex items-center justify-between gap-2 lg:justify-end"><Badge variant={point.verificationStatus === "verified" ? "success" : point.verificationStatus === "error" ? "danger" : "warning"}>{point.verificationStatus === "verified" ? "正常" : point.verificationStatus === "error" ? "异常" : "待验证"}</Badge><IconButton ariaLabel={`预览${point.name}`} title="预览" onClick={() => void previewAccessPoint(point)} disabled={point.verificationStatus !== "verified"}><Eye className="h-4 w-4" /></IconButton><IconButton ariaLabel={`重新验证${point.name}`} title="重新验证" onClick={() => void refreshAccessPoint(point.id)}><RefreshCcw className="h-4 w-4" /></IconButton><IconButton ariaLabel={`删除${point.name}`} title="删除" tone="danger" onClick={() => void removeAccessPoint(point.id)}><Trash2 className="h-4 w-4" /></IconButton></div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-border px-4 py-3 text-xs text-text-tertiary"><span>{accessPoints.length} 个接入点，共享同一 Workspace 授权</span><span>写操作均受 Policy 审批</span></div>
          </Card>

          <Card padding="none" className="order-1">
            <PanelHeader title="连接配置" description="凭据只保存在后端；页面仅展示脱敏值和连接状态.">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => notify("请在 Notion 中重新授权后替换 Token")}>
                  <Link2 className="h-4 w-4" />
                  重新授权
                </Button>
                <Button variant="outline" size="sm" onClick={() => void testConnection()} disabled={loadingConnection || testingConnection || savingConnection}>
                  <RefreshCcw className={`h-4 w-4 ${testingConnection ? "animate-spin" : ""}`} />
                  测试连接
                </Button>
                <Button variant="primary" size="sm" onClick={() => void saveConnectionConfig()} disabled={loadingConnection || testingConnection || savingConnection}>
                  <Check className="h-4 w-4" />
                  保存更改
                </Button>
              </div>
            </PanelHeader>
            <div className="space-y-5 p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2"><TextInput label="连接名称" value={connectionName} onChange={setConnectionName} /><TextInput label="授权方式" value="Internal Integration Token" disabled onChange={() => undefined} /></div>
              <div><div className="mb-2 text-xs font-medium text-text-secondary">Integration Token</div><div className="flex gap-2"><div className="relative min-w-0 flex-1"><input readOnly={Boolean(maskedToken) && !editingToken} type={showToken ? "text" : "password"} value={editingToken || !maskedToken ? tokenDraft : maskedToken} onChange={(event) => { setEditingToken(true); setTokenDraft(event.target.value); }} placeholder={maskedToken && !editingToken ? undefined : "输入 Notion Integration Token"} className="h-10 w-full rounded-ui-control border border-border bg-surface-primary px-3.5 pr-10 text-sm text-text-primary shadow-shadow-sm outline-none placeholder:text-text-tertiary focus:border-primary focus:ring-2 focus:ring-primary/20" /><IconButton ariaLabel={showToken ? "隐藏 Token" : "显示 Token"} className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setShowToken((value) => !value)}>{showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</IconButton></div>{maskedToken ? <Button variant="outline" size="md" onClick={() => { setEditingToken(true); setTokenDraft(""); setShowToken(false); }}>替换</Button> : null}</div><p className="mt-2 text-xs leading-5 text-text-tertiary">Token 只保存在 backend；页面只展示脱敏值。保存新 Token 前会先验证，验证失败不会覆盖旧凭据。</p></div>
              <div className="divide-y divide-border border-t border-border">
                <SettingLine title="启用 Notion 微应用" description="关闭后停止所有接入点调用，但保留配置." checked={enabled} onChange={() => setEnabled((value) => !value)} />
                <SettingLine title="默认允许只读动作" description="搜索、读取和查询可由 Agent 自动执行." checked={readOnly} onChange={() => setReadOnly((value) => !value)} />
                <div className="flex items-center justify-between gap-4 py-3"><div><div className="text-sm font-medium text-text-primary">知识库同步方式</div><div className="mt-1 text-xs text-text-tertiary">第一阶段仅支持用户手动触发同步.</div></div><Badge variant="muted">手动</Badge></div>
              </div>
            </div>
          </Card>
        </div>

        <aside className="min-w-0 space-y-5">
          <Card padding="none"><PanelHeader title={<div className="flex items-center gap-1.5"><span>可用能力</span><Tooltip placement="top" text="创建、追加、更新和同步属于外部副作用动作，必须经过 Mira Policy 审批；接入点权限不能绕过主 Agent 链路。"><span aria-label="写入操作说明" className="cursor-help text-icon-secondary"><CircleHelp className="h-3.5 w-3.5" /></span></Tooltip></div>} description="连接状态决定基础可用性，资源范围将在未来接入点中配置." /><div className="divide-y divide-border p-4">{connectionCapabilities.map((capability) => { const CapabilityIcon = capability.code === "search_read" ? Search : capability.code === "database_query" ? Database : capability.code === "content_write" ? Upload : Archive; const statusLabel = capability.status === "available" ? "可用" : capability.status === "reserved" ? "已预留" : "不可用"; const statusVariant = capability.status === "available" ? "success" : capability.status === "reserved" ? "muted" : "danger"; return <div key={capability.code} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-ui-control bg-primary/10 text-primary"><CapabilityIcon className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><div className="text-sm font-medium text-text-primary">{capability.label}</div><Badge variant={statusVariant}>{statusLabel}</Badge></div><div className="mt-1 text-xs leading-5 text-text-tertiary">{capability.description}</div></div></div>; })}</div></Card>
          <Card padding="none"><div className="flex items-start justify-between gap-2 border-b border-border px-4 py-4"><div className="min-w-0"><h2 className="text-sm font-semibold text-text-primary">最近活动</h2></div><Button variant="ghost" size="sm" className="shrink-0" onClick={() => setShowActivities(true)}>查看全部</Button></div><div className="divide-y divide-border p-4">{activities.slice(0, 3).length === 0 ? <div className="py-3 text-center text-xs text-text-tertiary">暂无活动记录</div> : activities.slice(0, 3).map((activity) => <ActivityItem key={activity.id} activity={activity} compact />)}</div></Card>
        </aside>
      </div>

      <ModalShell open={showAddModal} title="添加接入点" width={520} maxHeight="calc(100vh - 2rem)" onClose={() => setShowAddModal(false)} footer={<><Button variant="secondary" onClick={() => setShowAddModal(false)}>取消</Button><Button variant="primary" onClick={addAccessPoint}>验证并添加</Button></>}>
        <div className="space-y-4"><TextInput label="接入点名称" placeholder="例如：产品决策记录" value={newPoint.name} onChange={(value) => setNewPoint((current) => ({ ...current, name: value }))} /><Select label="类型" value={newPoint.type} onChange={(value) => setNewPoint((current) => ({ ...current, type: value as NotionAccessPoint["type"] }))} options={[{ value: "page_scope", label: "页面范围" }, { value: "database", label: "数据库" }, { value: "publish_target", label: "归档目标" }]} /><TextInput label="目标资源 ID 或 URL" placeholder="粘贴 Notion 页面或数据库 ID / URL" value={newPoint.resource} onChange={(value) => setNewPoint((current) => ({ ...current, resource: value }))} /><p className="-mt-2 text-xs leading-5 text-text-tertiary">添加时会向 Notion 验证资源是否已共享给当前 Integration。</p><div><div className="mb-2 text-xs font-medium text-text-secondary">允许动作</div><div className="flex flex-wrap gap-2">{[["搜索", "search"], ["读取", "read"], ["查询", "query"], ["创建页面", "create_page"], ["追加内容", "append_content"], ["更新记录", "update_record"], ["同步知识库", "sync_to_knowledge_base"]].map(([action, code]) => <label key={code} className="inline-flex items-center gap-2 rounded-ui-control border border-border bg-surface-secondary px-3 py-2 text-xs text-text-secondary"><input type="checkbox" checked={newPointActions.includes(code)} onChange={(event) => setNewPointActions((current) => event.target.checked ? [...current, code] : current.filter((item) => item !== code))} className="accent-primary" />{action}</label>)}</div></div></div>
      </ModalShell>
      <NotionSetupDrawer open={showSetupGuide} onClose={() => setShowSetupGuide(false)} />
      <AccessPointPreviewDrawer open={showPreview} preview={preview} loading={loadingPreview} error={previewError} onClose={() => setShowPreview(false)} />
      <Drawer open={showActivities} onClose={() => setShowActivities(false)} width={520} header={<div><h2 className="text-sm font-semibold text-text-primary">最近活动</h2><p className="mt-1 text-xs text-text-tertiary">Notion 操作的可审计摘要</p></div>}>
        {activities.length === 0 ? <div className="py-12 text-center text-sm text-text-secondary">暂无活动记录</div> : <div className="divide-y divide-border">{activities.map((activity) => <ActivityItem key={activity.id} activity={activity} />)}</div>}
      </Drawer>
    </MicroAppPageLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><div className="truncate text-[11px] text-text-tertiary">{label}</div><div className="mt-1 truncate text-xs font-medium text-text-primary">{value}</div></div>; }
function ValueCell({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><div className="mb-1 text-[11px] text-text-tertiary">{label}</div><div className="truncate text-xs text-text-secondary" title={value}>{value}</div></div>; }
function PanelHeader({ title, description, children }: { title: ReactNode; description: string; children?: ReactNode }) { return <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5"><div><h2 className="text-sm font-semibold text-text-primary">{title}</h2><p className="mt-1 text-xs leading-5 text-text-tertiary">{description}</p></div>{children}</div>; }
function SettingLine({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: () => void }) { return <div className="flex items-center justify-between gap-4 py-3"><div><div className="text-sm font-medium text-text-primary">{title}</div><div className="mt-1 text-xs text-text-tertiary">{description}</div></div><Switch checked={checked} onChange={onChange} ariaLabel={title} size="sm" /></div>; }
function ActivityItem({ activity, compact = false }: { activity: NotionActivity; compact?: boolean }) {
  const statusLabel = activity.status === "completed" ? "已完成" : activity.status === "failed" ? "失败" : "已拦截";
  const statusClass = activity.status === "completed" ? "bg-success" : activity.status === "failed" ? "bg-danger" : "bg-warning";
  return <div className={`flex gap-3 py-3 ${compact ? "first:pt-0 last:pb-0" : ""}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${statusClass}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><div className="text-xs font-medium text-text-primary">{activityLabels[activity.action] ?? activity.action}</div><Badge variant={activity.status === "completed" ? "success" : activity.status === "failed" ? "danger" : "warning"}>{statusLabel}</Badge></div><div className="mt-1 text-xs leading-5 text-text-secondary">{activity.summary}</div><div className="mt-1 text-[11px] text-text-tertiary">{new Date(activity.occurredAt).toLocaleString()} {compact ? "" : activity.resourceId ? `· 资源 ${activity.resourceId}` : ""}</div></div></div>;
}

function extractNotionResourceId(value: string) {
  const uuid = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if (uuid) return uuid;

  const compactId = value.match(/(?:^|[^0-9a-f])[0-9a-f]{32}(?:$|[^0-9a-f])/i)?.[0];
  if (compactId) return compactId.replace(/[^0-9a-f]/gi, "");

  if (!/^https?:\/\//i.test(value) && /^[0-9a-f]{32}$/i.test(value)) return value;
  return null;
}
