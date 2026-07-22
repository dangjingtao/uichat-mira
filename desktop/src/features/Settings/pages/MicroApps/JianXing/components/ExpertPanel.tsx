import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Link, MessageCircle, Send } from "lucide-react";
import { Alert, Badge, Button, Card, Select, TextInput } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import {
  connectExternalExpert,
  consultExternalExpert,
  ensureExternalExpert,
  listExternalExperts,
  type ExternalExpert,
  type ExternalExpertProvider,
} from "@/shared/api/externalExperts";

type Props = { extensionConnected: boolean };

export default function ExpertPanel({ extensionConnected }: Props) {
  const [experts, setExperts] = useState<ExternalExpert[]>([]);
  const [provider, setProvider] = useState<ExternalExpertProvider>("chatgpt");
  const [consultation, setConsultation] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = useMemo(() => experts.find((expert) => expert.provider === provider) || null, [experts, provider]);

  const load = async () => {
    try {
      const existing = await listExternalExperts();
      setExperts(existing);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "无法初始化 ChatGPT 专家"); }
  };
  useEffect(() => { void load(); }, []);

  const connect = async () => {
    setBusy(true); setError("");
    try {
      let expert = selected;
      if (!expert) {
        expert = await ensureExternalExpert(provider);
        setExperts((current) => current.some((item) => item.provider === provider)
          ? current.map((item) => item.provider === provider ? expert! : item)
          : [...current, expert!]);
      }
      const connected = await connectExternalExpert(expert.id);
      setExperts((current) => current.map((item) => item.id === connected.id ? connected : item)); message.success("已建立 ChatGPT 专家连接");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "建立专家连接失败"); }
    finally { setBusy(false); }
  };
  const changeProvider = async (value: string) => {
    const nextProvider = value as ExternalExpertProvider;
    setProvider(nextProvider);
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
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-heading-2 text-text-primary">问策</h2><p className="mt-1 text-sm text-text-secondary">每个 Provider 只保留一个外部专家实例。</p></div><Badge variant="neutral">MVP</Badge></div>
        <Select label="Provider" value={provider} onChange={(value) => void changeProvider(value)} options={[{ value: "chatgpt", label: "ChatGPT" }, { value: "kimi", label: "Kimi" }, { value: "deepseek", label: "DeepSeek" }]} />
        {selected ? <div className="flex items-center gap-2 text-sm text-text-secondary"><Badge variant={selected.status === "ready" ? "success" : "warning"}>{selected.status}</Badge>{selected.accountLabel || "尚未建立网页连接"}</div> : <div className="text-sm text-text-tertiary">当前 Provider 尚未创建专家实例，创建连接时会自动复用该 Provider 的唯一实例。</div>}
        <Button size="sm" variant="secondary" onClick={() => void connect()} disabled={busy || !extensionConnected}><Link className="h-4 w-4" />创建连接</Button>
      </Card>
      <Card padding="md" className="flex min-h-0 flex-col gap-3"><h2 className="text-heading-2 text-text-primary">咨询</h2>{error ? <Alert variant="danger" title="问策失败"><span className="flex items-center gap-2"><CircleAlert className="h-4 w-4" />{error}</span></Alert> : null}<TextInput label="咨询内容" value={consultation} onChange={setConsultation} placeholder="向 ChatGPT 专家提问" /><Button onClick={() => void consult()} disabled={busy || !selected || selected.status !== "ready"}><Send className="h-4 w-4" />{busy ? "等待专家回复…" : "发送咨询"}</Button><div className="min-h-48 flex-1 rounded-ui-control border border-border bg-surface-secondary p-3">{reply ? <div className="whitespace-pre-wrap text-sm leading-6 text-text-primary">{reply}</div> : <div className="flex h-full min-h-40 items-center justify-center text-sm text-text-tertiary"><MessageCircle className="mr-2 h-4 w-4" />还没有专家回复</div>}</div></Card>
    </div>
  );
}
