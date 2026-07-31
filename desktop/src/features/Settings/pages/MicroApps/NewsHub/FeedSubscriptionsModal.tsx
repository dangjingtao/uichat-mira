import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink as ExternalLinkIcon, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import {
  createNewsFeedSubscription,
  deleteNewsFeedSubscription,
  detectNewsFeed,
  listNewsFeedSubscriptions,
  refreshNewsFeedSubscription,
  updateNewsFeedSubscription,
  type NewsFeedCandidate,
  type NewsFeedSubscription,
} from "@/shared/api/newsHub";
import { Badge, Button, ExternalLink, Modal, Select, Switch, TextInput, message } from "@/shared/ui";

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function FeedSubscriptionsModal({ open, onClose, onChanged }: Props) {
  const { t, i18n } = useTranslation();
  const [feeds, setFeeds] = useState<NewsFeedSubscription[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [url, setUrl] = useState("");
  const [candidates, setCandidates] = useState<NewsFeedCandidate[]>([]);
  const [detectError, setDetectError] = useState("");
  const [selectedUrl, setSelectedUrl] = useState("");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("general");
  const [lang, setLang] = useState(i18n.language.toLowerCase().startsWith("zh") ? "zh" : "en");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadFeeds = async (showLoading = false) => {
    if (showLoading) setListLoading(true);
    try {
      setFeeds(await listNewsFeedSubscriptions());
    } catch (error) {
      message.error(getErrorMessage(error, t("settings.microApps.newsHub.feeds.loadFailed")));
    } finally {
      if (showLoading) setListLoading(false);
    }
  };

  useEffect(() => {
    void loadFeeds(true);
  }, []);

  useEffect(() => {
    if (open && !listLoading) void loadFeeds(false);
  }, [open]);

  const resetForm = () => {
    setMode("list");
    setUrl("");
    setCandidates([]);
    setDetectError("");
    setSelectedUrl("");
    setName("");
    setTopic("general");
    setEditingId(null);
  };

  const handleDetect = async () => {
    if (!url.trim()) return;
    setActionLoading(true);
    setDetectError("");
    try {
      const result = await detectNewsFeed(url.trim());
      setCandidates(result);
      setSelectedUrl(result[0]?.feedUrl ?? "");
      setName(result[0]?.name ?? "");
    } catch (error) {
      const errorMessage = getErrorMessage(error, t("settings.microApps.newsHub.feeds.detectFailed"));
      setCandidates([]);
      setSelectedUrl("");
      setDetectError(errorMessage);
      message.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedUrl) return;
    setActionLoading(true);
    try {
      await createNewsFeedSubscription({ feedUrl: selectedUrl, name: name.trim() || undefined, topic, lang });
      message.success(t("settings.microApps.newsHub.feeds.created"));
      resetForm();
      await Promise.all([loadFeeds(false), onChanged()]);
    } catch (error) {
      message.error(getErrorMessage(error, t("settings.microApps.newsHub.feeds.createFailed")));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !name.trim()) return;
    setActionLoading(true);
    try {
      await updateNewsFeedSubscription(editingId, { name: name.trim(), topic, lang });
      message.success(t("settings.microApps.newsHub.feeds.updated"));
      resetForm();
      await Promise.all([loadFeeds(false), onChanged()]);
    } catch (error) {
      message.error(getErrorMessage(error, t("settings.microApps.newsHub.feeds.updateFailed")));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggle = async (feed: NewsFeedSubscription, enabled: boolean) => {
    setBusyId(feed.id);
    try {
      await updateNewsFeedSubscription(feed.id, { enabled });
      if (enabled) await refreshNewsFeedSubscription(feed.id);
      await Promise.all([loadFeeds(false), onChanged()]);
    } catch (error) {
      message.error(getErrorMessage(error, t("settings.microApps.newsHub.feeds.updateFailed")));
    } finally {
      setBusyId(null);
    }
  };

  const handleRefresh = async (feed: NewsFeedSubscription) => {
    setBusyId(feed.id);
    try {
      await refreshNewsFeedSubscription(feed.id);
      await Promise.all([loadFeeds(false), onChanged()]);
    } catch (error) {
      message.error(getErrorMessage(error, t("settings.microApps.newsHub.feeds.refreshFailed")));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (feed: NewsFeedSubscription) => {
    Modal.confirm({
      title: t("settings.microApps.newsHub.feeds.deleteTitle"),
      description: t("settings.microApps.newsHub.feeds.deleteDescription", { name: feed.name }),
      confirmText: t("settings.microApps.newsHub.feeds.deleteConfirm"),
      tone: "danger",
      onConfirm: async () => {
        await deleteNewsFeedSubscription(feed.id);
        await Promise.all([loadFeeds(false), onChanged()]);
        message.success(t("settings.microApps.newsHub.feeds.deleted"));
      },
    });
  };

  const beginEdit = (feed: NewsFeedSubscription) => {
    setEditingId(feed.id);
    setName(feed.name);
    setTopic(feed.topic);
    setLang(feed.lang);
    setMode("edit");
  };

  const selected = candidates.find((candidate) => candidate.feedUrl === selectedUrl);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("settings.microApps.newsHub.feeds.title")}
      width={780}
      maxHeight="82vh"
      footer={null}
    >
      {mode === "list" ? (
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-text-secondary">{t("settings.microApps.newsHub.feeds.description")}</p>
            <Button variant="primary" size="sm" onClick={() => setMode("add")}>
              <Plus className="h-4 w-4" />
              {t("settings.microApps.newsHub.feeds.add")}
            </Button>
          </div>
          {listLoading && feeds.length === 0 ? <div className="py-8 text-center text-text-secondary">{t("settings.microApps.newsHub.feeds.loading")}</div> : null}
          {!listLoading && feeds.length === 0 ? (
            <div className="rounded-ui-panel border border-dashed border-border p-8 text-center text-text-secondary">
              {t("settings.microApps.newsHub.feeds.empty")}
            </div>
          ) : null}
          {feeds.map((feed) => (
            <div key={feed.id} className="rounded-ui-panel border border-border bg-surface-primary p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-text-primary">{feed.name}</span>
                    <Badge variant="muted" size="sm">{feed.format.toUpperCase()}</Badge>
                    {feed.lastFetchStatus === "failed" ? <Badge variant="danger" size="sm">{t("settings.microApps.newsHub.feeds.failed")}</Badge> : null}
                  </div>
                  <div className="mt-1 truncate text-xs text-text-tertiary">{feed.feedUrl}</div>
                  <div className="mt-2 text-xs text-text-secondary">
                    {t("settings.microApps.newsHub.feeds.itemCount", { count: feed.itemCount })}
                    {feed.lastFetchedAt ? ` · ${new Date(feed.lastFetchedAt).toLocaleString(i18n.language)}` : ""}
                  </div>
                  {feed.lastFetchError ? <div className="mt-2 text-xs text-danger-text">{feed.lastFetchError}</div> : null}
                </div>
                <Switch checked={feed.enabled} onChange={() => void handleToggle(feed, !feed.enabled)} disabled={busyId === feed.id} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button size="xs" variant="outline" disabled={busyId === feed.id || !feed.enabled} onClick={() => void handleRefresh(feed)}>
                  <RefreshCcw className={`h-3.5 w-3.5 ${busyId === feed.id ? "animate-spin" : ""}`} />
                  {t("settings.microApps.newsHub.feeds.refresh")}
                </Button>
                <Button size="xs" variant="ghost" onClick={() => beginEdit(feed)}><Pencil className="h-3.5 w-3.5" />{t("settings.microApps.newsHub.feeds.edit")}</Button>
                <ExternalLink className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-primary" href={feed.siteUrl || feed.feedUrl}><ExternalLinkIcon className="h-3.5 w-3.5" />{t("settings.microApps.newsHub.feeds.open")}</ExternalLink>
                <Button className="ml-auto" size="xs" variant="danger-ghost" onClick={() => handleDelete(feed)}><Trash2 className="h-3.5 w-3.5" />{t("settings.microApps.newsHub.feeds.delete")}</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {mode === "add" ? (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <TextInput
                label={t("settings.microApps.newsHub.feeds.urlLabel")}
                value={url}
                onChange={(value) => {
                  setUrl(value);
                  setCandidates([]);
                  setSelectedUrl("");
                  setName("");
                  setDetectError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && url.trim() && !actionLoading) void handleDetect();
                }}
                placeholder="https://example.com/blog"
              />
              <Button variant="outline" onClick={() => void handleDetect()} disabled={actionLoading || !url.trim()}>
                {actionLoading ? t("settings.microApps.newsHub.feeds.detecting") : t("settings.microApps.newsHub.feeds.detect")}
              </Button>
            </div>
          ) : null}
          {mode === "add" && candidates.length === 0 && !detectError ? (
            <div className="rounded-ui-control bg-surface-secondary/50 px-3 py-2 text-xs text-text-secondary">
              {t("settings.microApps.newsHub.feeds.detectHint")}
            </div>
          ) : null}
          {detectError ? (
            <div className="rounded-ui-control border border-danger-border bg-danger-soft px-3 py-2 text-xs text-danger-text">
              {detectError}
            </div>
          ) : null}
          {candidates.length > 0 ? (
            <div className="grid gap-2">
              <div className="text-xs font-medium text-text-secondary">{t("settings.microApps.newsHub.feeds.candidates")}</div>
              {candidates.map((candidate) => (
                <button key={candidate.feedUrl} type="button" onClick={() => { setSelectedUrl(candidate.feedUrl); setName(candidate.name); }} className={`rounded-ui-control border p-3 text-left ${selectedUrl === candidate.feedUrl ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="font-medium text-text-primary">{candidate.name}</div>
                  <div className="mt-1 truncate text-xs text-text-tertiary">{candidate.feedUrl}</div>
                </button>
              ))}
            </div>
          ) : null}
          {(mode === "edit" || selected) ? (
            <div className="grid gap-3 rounded-ui-panel border border-border p-4">
              <TextInput label={t("settings.microApps.newsHub.feeds.nameLabel")} value={name} onChange={setName} />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput label={t("settings.microApps.newsHub.feeds.topicLabel")} value={topic} onChange={setTopic} />
                <Select label={t("settings.microApps.newsHub.feeds.langLabel")} value={lang} onChange={setLang} options={[{ value: "zh", label: "中文" }, { value: "en", label: "English" }, { value: "auto", label: t("settings.microApps.newsHub.feeds.auto") }]} />
              </div>
              {selected?.previewItems.length ? (
                <div className="grid gap-1 text-xs text-text-secondary">
                  <div className="font-medium">{t("settings.microApps.newsHub.feeds.preview")}</div>
                  {selected.previewItems.slice(0, 3).map((item) => <div key={`${item.url}-${item.title}`} className="truncate">· {item.title}</div>)}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="secondary" onClick={resetForm}>{t("settings.microApps.newsHub.feeds.cancel")}</Button>
            {mode === "edit" || selected ? (
              <Button variant="primary" disabled={actionLoading || (mode === "add" ? !selectedUrl : !name.trim())} onClick={() => void (mode === "add" ? handleCreate() : handleUpdate())}>
                {mode === "add" ? t("settings.microApps.newsHub.feeds.subscribe") : t("common.actions.save")}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
