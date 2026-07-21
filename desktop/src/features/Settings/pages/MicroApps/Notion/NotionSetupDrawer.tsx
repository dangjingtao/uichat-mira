import { CheckCircle2, Database, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import Drawer from "@/shared/ui/Drawer";
import Badge from "@/shared/ui/Badge";
import { Button } from "@/shared/ui";

type NotionSetupDrawerProps = {
  open: boolean;
  onClose: () => void;
};

const steps = [
  {
    number: "01",
    title: "在 Notion 创建连接",
    icon: KeyRound,
    body: <>进入 Notion 开发者后台，创建一个 <strong>Internal Connection</strong>，建议名称为 <code>UIChat Mira</code>，然后选择需要接入的 Workspace。</>,
  },
  {
    number: "02",
    title: "开启权限",
    icon: ShieldCheck,
    body: <><p>建议首期开启：</p><ul><li>Read content</li><li>Update content</li><li>Insert content</li></ul><p className="mt-3">暂时关闭：</p><ul><li>Read comments</li><li>Insert comments</li><li>User information</li></ul><p className="mt-3">创建完成后，复制 <strong>Installation Access Token</strong>。</p></>,
  },
  {
    number: "03",
    title: "授权页面和数据库",
    icon: ExternalLink,
    body: <><p>Token 默认不能访问整个 Workspace。在需要接入的页面或数据库中选择：</p><div className="my-3 rounded-ui-control border border-border bg-surface-secondary px-3 py-2 text-xs text-text-secondary">右上角 ··· <span className="mx-1 text-text-tertiary">→</span> Add connections <span className="mx-1 text-text-tertiary">→</span> UIChat Mira</div><p>建议先授权项目文档、项目任务库、产品决策记录和博客草稿，不要一开始授权整个 Workspace。</p></>,
  },
  {
    number: "04",
    title: "在 Mira 中填写连接",
    icon: CheckCircle2,
    body: <><p>进入 <strong>设置 → 微应用 → Notion</strong>，填写连接名称和 Access Token，然后点击“测试连接”。</p><div className="mt-3 space-y-2 rounded-ui-control border border-border bg-surface-secondary px-3 py-3 text-xs"><div><span className="text-text-tertiary">连接名称：</span>Tomz Notion</div><div><span className="text-text-tertiary">授权方式：</span>Internal Connection</div><div><span className="text-text-tertiary">Access Token：</span>Notion Token</div></div></>,
  },
  {
    number: "05",
    title: "添加接入点",
    icon: Database,
    body: <><p>点击“添加接入点”，填写名称，选择“页面范围”“数据库”或“归档目标”，再粘贴目标资源 ID 或 URL。</p><p className="mt-3">页面支持直接粘贴 Notion URL，会自动提取资源 ID。数据库必须选择数据库类型，页面必须选择页面范围或归档目标。</p><p className="mt-3">只勾选需要的动作，然后点击“验证并添加”。验证成功后接入点才会启用。</p></>,
  },
];

export default function NotionSetupDrawer({ open, onClose }: NotionSetupDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      closeLabel="关闭 Notion 接入说明"
      closeMaskLabel="关闭 Notion 接入说明"
      header={<div><div className="text-base font-semibold text-text-primary">Notion 接入说明</div><div className="mt-1 text-xs text-text-tertiary">完成连接后，再逐步授权需要使用的资源。</div></div>}
      footer={<Button variant="secondary" size="sm" onClick={onClose}>关闭</Button>}
      bodyClassName="space-y-5"
    >
      <div className="rounded-ui-panel border border-warning-border bg-warning-soft px-3.5 py-3 text-xs leading-5 text-warning-text">
        Token 只保存在 Mira backend，不要提交到 GitHub，也不要写进前端代码。
      </div>

      <div className="space-y-4">
        {steps.map(({ number, title, icon: Icon, body }) => (
          <section key={number} className="relative pl-10">
            <div className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-ui-control bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
            <div className="flex items-center gap-2"><span className="text-[11px] font-semibold text-primary">{number}</span><h2 className="text-sm font-semibold text-text-primary">{title}</h2></div>
            <div className="mt-2 text-xs leading-5 text-text-secondary">{body}</div>
          </section>
        ))}
      </div>

      <section className="border-t border-border pt-4">
        <div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-text-primary">接入点授权规则</h2><Badge variant="muted">最小权限</Badge></div>
        <p className="mt-2 text-xs leading-5 text-text-secondary">一个 Workspace Token 可以配置多个接入点。每个页面或数据库都必须在 Notion 中通过“··· → Add connections → UIChat Mira”单独授权。数据库视图需要授权原始数据库。</p>
        <div className="mt-3 rounded-ui-control border border-border bg-surface-secondary px-3 py-3 text-xs leading-5 text-text-secondary"><strong className="font-medium text-text-primary">验证失败时：</strong>检查 Integration 是否已共享、接入点类型是否匹配，以及填写的 ID 是否属于目标页面或数据库。共享资源后点击接入点右侧的重新验证。</div>
      </section>

      <section className="border-t border-border pt-4">
        <h2 className="text-sm font-semibold text-text-primary">验收检查</h2>
        <ul className="mt-2 space-y-2 text-xs leading-5 text-text-secondary">
          {["Token 测试成功", "Workspace 信息显示正确", "Token 只保存在 backend", "未授权资源无法访问", "写入操作需要确认"].map((item) => <li key={item} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-icon-secondary" />{item}</li>)}
        </ul>
      </section>
    </Drawer>
  );
}
