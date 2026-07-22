import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Link, MessageCircle, Plus, Send } from "lucide-react";
import { Alert, Badge, Button, Card, Select, TextInput } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import {
  connectExternalExpert,
  consultExternalExpert,
  createExternalExpert,
  listExternalExperts,
  type ExternalExpert,
  type ExternalExpertProvider,
} from "@/shared/api/externalExperts";

type Props = { extensionConnected: boolean };

const providerOptions = [
  { value: "chatgpt", label: "ChatGPT" },
  { value: "kimi", label: "Kimi（暂未支持）" },
  { value: "deepseek", label: "DeepSeek（暂未支持）" },
];

export default function ExpertPanel({ extensionConnected }: Props) {
  const [experts, setExperts] = useState<ExternalExpert[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<ExternalExpertProvider>("chatgpt");
  const [consultation, setConsultation] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = useMemo(() => experts.find((expert) => expert.id === selectedId) || null, [experts, selectedId]);

  const load = async () => {
    try { setExperts(await listExternalExperts()); } catch (cause) { setError(cause instanceof Error ? cause.message : "无法读取专家列表"); }
  };
  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (!name.trim()) { setError("请输入专家名称"); return; }
    setBusy(true); setError("");
    try {
      const expert = await createExternalExpert({ name, provider });
      setExperts((current) => [expert, ...current]); setSelectedId(expert.id); setName(""); message.success("专家已创建");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "创建专家失败"); }
    finally { setBusy(false); }
  };
  const connect = async () => {
    if (!selected) { setError("请先选择专家"); return; }
    setBusy(true); setError("");
    try {
      const expert = await connectExternalExpert(selected.id);
      setExperts((current) => current.map((item) => item.id === expert.id ? expert : item)); message.success("已建立 ChatGPT 专家连接");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "绑定专家失败"); }
    finally { setBusy(false); }
  };
  const consult = async () => {
    if (!selected || !consultation.trim()) { setError("请输入咨询内容"); return; }
    setBusy(true); setError(""); setReply("");
    try { const result = await consultExternalExpert(selected.id, consultation); setReply(result.reply); setConsultation(""); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "专家咨询失败"); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-0 gap-4 md:grid-cols-2">
      <Card padding="md" className="space-y-4">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-heading-2 text-text-primary">问策</h2><p className="mt-1 text-sm text-text-secondary">向用户已登录的外部 AI 线程咨询，回复只作为建议返回 Mira。</p></div><Badge variant="neutral">MVP</Badge></div>
        <div className="space-y-2 border-b border-border pb-4"><TextInput label="专家名称" value={name} onChange={setName} placeholder="例如 ChatGPT 产品顾问" /><Select label="Provider" value={provider} onChange={(value) => setProvider(value as ExternalExpertProvider)} options={providerOptions} /><Button size="sm" onClick={() => void create()} disabled={busy}><Plus className="h-4 w-4" />创建专家</Button></div>
        <Select label="当前专家" value={selectedId} onChange={setSelectedId} options={[{ value: "", label: "选择专家" }, ...experts.map((expert) => ({ value: expert.id, label: `${expert.name} · ${expert.provider}` }))]} />
        {selected ? <><div className="flex items-center gap-2 text-sm text-text-secondary"><Badge variant={selected.status === "ready" ? "success" : "warning"}>{selected.status}</Badge>{selected.accountLabel || "尚未建立网页连接"}</div><Button size="sm" variant="secondary" onClick={() => void connect()} disabled={busy || !extensionConnected}><Link className="h-4 w-4" />建立新连接</Button></> : <div className="text-sm text-text-tertiary">先创建一个专家。</div>}
      </Card>
      <Card padding="md" className="flex min-h-0 flex-col gap-3"><h2 className="text-heading-2 text-text-primary">咨询</h2>{error ? <Alert variant="danger" title="问策失败"><span className="flex items-center gap-2"><CircleAlert className="h-4 w-4" />{error}</span></Alert> : null}<TextInput label="咨询内容" value={consultation} onChange={setConsultation} placeholder="向已绑定的外部专家提问" /><Button onClick={() => void consult()} disabled={busy || !selected || selected.status !== "ready"}><Send className="h-4 w-4" />{busy ? "等待专家回复…" : "发送咨询"}</Button><div className="min-h-48 flex-1 rounded-ui-control border border-border bg-surface-secondary p-3">{reply ? <div className="whitespace-pre-wrap text-sm leading-6 text-text-primary">{reply}</div> : <div className="flex h-full min-h-40 items-center justify-center text-sm text-text-tertiary"><MessageCircle className="mr-2 h-4 w-4" />还没有专家回复</div>}</div></Card>
    </div>
  );
}
