import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownUp,
  ChevronDown,
  DatabaseZap,
  Ellipsis,
  ExternalLink,
  FilePlus2,
  FileSpreadsheet,
  Filter,
  Search,
  Settings2,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import { StatusIndicator } from "@/shared/ui/StatusIndicator";
import Tooltip from "@/shared/ui/Tooltip";
import {
  type FilterKey,
  type KnowledgeBaseDocument,
  type SegmentMode,
  type SortKey,
  filterOptions,
  formatCompactNumber,
  getTypeBadge,
  mockDocuments,
  sortOptions,
} from "./mockData";

const inputClassName =
  "h-10 w-full rounded-xl border border-border bg-surface-primary pl-10 pr-3 text-sm text-text-primary shadow-shadow-sm transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function SegmentBadge({ mode }: { mode: SegmentMode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-secondary">
      {mode}
    </span>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-surface-tertiary"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-shadow-sm transition-transform duration-150 ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function KnowledgeBaseSettings() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState(mockDocuments);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("uploadedAt");
  const [sortDescending, setSortDescending] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return documents
      .filter((document) => {
        if (filter === "enabled") {
          return document.availability === "enabled";
        }

        if (filter === "disabled") {
          return document.availability === "disabled";
        }

        return true;
      })
      .filter((document) => {
        if (!normalizedSearch) {
          return true;
        }

        return (
          document.name.toLowerCase().includes(normalizedSearch) ||
          document.source.toLowerCase().includes(normalizedSearch) ||
          document.owner.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((left, right) => {
        const direction = sortDescending ? -1 : 1;

        if (sortKey === "uploadedAt") {
          return (
            (new Date(left.uploadedAt).getTime() - new Date(right.uploadedAt).getTime()) *
            direction
          );
        }

        return (left[sortKey] - right[sortKey]) * direction;
      });
  }, [documents, filter, searchText, sortDescending, sortKey]);

  const visibleIds = filteredDocuments.map((document) => document.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const selectedDocuments = documents.filter((document) =>
    selectedIds.includes(document.id),
  );
  const enabledCount = documents.filter(
    (document) => document.availability === "enabled",
  ).length;
  const totalHits = documents.reduce((sum, document) => sum + document.hits, 0);

  const toggleSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  };

  const updateDocument = (
    id: string,
    updater: (document: KnowledgeBaseDocument) => KnowledgeBaseDocument,
  ) => {
    setDocuments((current) =>
      current.map((document) => (document.id === id ? updater(document) : document)),
    );
  };

  const goToDetail = (document: KnowledgeBaseDocument) => {
    navigate(`/settings/knowledge-base/detail?id=${encodeURIComponent(document.id)}`);
  };

  const openMetadataModal = () => {
    Modal.show({
      title: "元数据概览",
      width: 720,
      content: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card label="文档总数" value={`${documents.length}`} description="当前假数据集" />
            <Card label="可用文档" value={`${enabledCount}`} description="正在参与召回" />
            <Card label="总召回次数" value={`${totalHits}`} description="用于展示交互效果" />
          </div>
          <div className="rounded-xl border border-border bg-surface-secondary p-4 text-sm leading-6 text-text-secondary">
            这里先用假数据演示知识库元数据、分段信息和同步来源。后续接真实接口时，可以把统计、标签、同步状态和检索质量指标接进来。
          </div>
        </div>
      ),
    });
  };

  const openAddDocumentModal = () => {
    navigate("/settings/knowledge-base/add?step=1");
  };

  const openDocumentSettings = (document: KnowledgeBaseDocument) => {
    const modalKey = Modal.show({
      title: `文档设置 · ${document.name}`,
      width: 680,
      content: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card label="分段模式" value={document.segmentMode} description={`${document.chunkCount} 个分段`} />
            <Card label="同步来源" value={document.source} description={`维护人：${document.owner}`} />
            <Card label="字符数" value={formatCompactNumber(document.charCount)} description="当前展示值为假数据" />
            <Card label="召回次数" value={`${document.hits}`} description="可用于后续质量评估" />
          </div>
          <div className="rounded-xl border border-border bg-surface-secondary p-4 text-sm leading-6 text-text-secondary">
            这里可以继续扩展分段策略、重建索引、召回阈值、标签管理等配置。当前先保留交互壳子，方便你后续接真实接口。
          </div>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" onClick={() => Modal.close(modalKey)}>
            关闭
          </Button>
          <Button
            onClick={() => {
              Modal.close(modalKey);
              message.success(`已保存 ${document.name} 的模拟配置`);
            }}
          >
            保存设置
          </Button>
        </>
      ),
    });
  };

  const openMoreActions = (document: KnowledgeBaseDocument) => {
    const modalKey = Modal.show({
      title: `更多操作 · ${document.name}`,
      width: 560,
      content: (
        <div className="space-y-3">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-primary px-4 py-3 text-left transition-all duration-150 hover:bg-surface-secondary"
            onClick={() => {
              updateDocument(document.id, (current) => ({
                ...current,
                syncState: "indexing",
              }));
              Modal.close(modalKey);
              message.info(`已开始重建 ${document.name} 的模拟索引`);
            }}
          >
            <div>
              <div className="text-sm font-medium text-text-primary">重建索引</div>
              <div className="text-sm text-text-secondary">用于演示知识库重新分段与入库</div>
            </div>
            <ArrowDownUp className="h-4 w-4 text-icon-secondary" />
          </button>

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-primary px-4 py-3 text-left transition-all duration-150 hover:bg-surface-secondary"
            onClick={() => {
              Modal.close(modalKey);
              message.success(`已复制 ${document.name} 的模拟链接`);
            }}
          >
            <div>
              <div className="text-sm font-medium text-text-primary">复制外链</div>
              <div className="text-sm text-text-secondary">模拟复制共享地址</div>
            </div>
            <ExternalLink className="h-4 w-4 text-icon-secondary" />
          </button>
        </div>
      ),
      footer: null,
    });
  };

  return (
    <div className="flex w-full flex-col gap-5 px-5 py-6">
      <section className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
          Knowledge Base
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-text-primary">知识库</h1>
            <p className="max-w-3xl text-sm leading-6 text-text-secondary">
              知识库中的所有文件会展示在这里。双击任意数据行可进入详情页，点击添加文件会进入分步上传表单。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={openMetadataModal}>
              <DatabaseZap className="h-4 w-4" />
              元数据
            </Button>
            <Button onClick={openAddDocumentModal}>
              <FilePlus2 className="h-4 w-4" />
              添加文件
            </Button>
          </div>
        </div>
      </section>

      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
            <div className="inline-flex rounded-xl border border-border bg-surface-secondary p-1">
              {filterOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFilter(option.key)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                    filter === option.key
                      ? "bg-surface-primary text-text-primary shadow-shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[280px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-icon-secondary" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜索文档名称、来源或维护人"
                className={inputClassName}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSortDescending((current) => !current)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface-primary px-3 text-sm text-text-secondary shadow-shadow-sm transition-all duration-150 hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
            >
              <Filter className="h-4 w-4" />
              排序：
              <span className="font-medium text-text-primary">
                {sortOptions.find((option) => option.key === sortKey)?.label}
              </span>
              <ArrowDownUp className="h-4 w-4" />
            </button>

            <div className="relative">
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="h-10 min-w-[124px] appearance-none rounded-xl border border-border bg-surface-primary pl-3 pr-9 text-sm text-text-primary shadow-shadow-sm transition-all duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {sortOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-icon-secondary" />
            </div>
          </div>
        </div>

        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
            <div className="text-sm text-text-secondary">
              已选择
              <span className="mx-1 font-semibold text-text-primary">{selectedIds.length}</span>
              个文档
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedIds([]);
                  message.info("已清空选择");
                }}
              >
                取消选择
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  Modal.show({
                    title: "批量操作",
                    content: (
                      <div className="space-y-3 text-sm text-text-secondary">
                        <p>当前为假数据交互页，已选文档如下：</p>
                        <div className="rounded-xl border border-border bg-surface-secondary p-3 text-text-primary">
                          {selectedDocuments.map((document) => document.name).join("、")}
                        </div>
                      </div>
                    ),
                  });
                }}
              >
                批量操作
              </Button>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border bg-surface-primary shadow-shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-secondary">
                <th className="w-12 px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  <input
                    type="checkbox"
                    aria-label="全选当前列表"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                  />
                </th>
                <th className="w-12 px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  名称
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  分段模式
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  字符数
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  召回次数
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  上传时间
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  状态
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((document, index) => {
                const badge = getTypeBadge(document.type);

                return (
                  <tr
                    key={document.id}
                    onDoubleClick={() => goToDetail(document)}
                    className={`cursor-pointer transition-colors duration-150 hover:bg-surface-secondary/80 ${
                      index > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        aria-label={`选择 ${document.name}`}
                        checked={selectedIds.includes(document.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleSelection(document.id)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-text-secondary">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary">
                      <div className="flex min-w-[280px] items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-secondary">
                          <FileSpreadsheet className="h-4 w-4 text-icon-primary" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="truncate font-medium text-text-primary">{document.name}</div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
                              {badge.label}
                            </span>
                            <span className="text-xs text-text-tertiary">{document.source}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-text-primary">
                      <SegmentBadge mode={document.segmentMode} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-text-primary">
                      {formatCompactNumber(document.charCount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-text-primary">
                      {document.hits}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-text-primary">
                      {document.uploadedAt}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-text-primary">
                      <div className="inline-flex items-center gap-2">
                        <StatusIndicator
                          status={document.availability === "enabled" ? "running" : "stopped"}
                          size="sm"
                        />
                        <span
                          className={`text-sm font-medium ${
                            document.availability === "enabled"
                              ? "text-success"
                              : "text-text-secondary"
                          }`}
                        >
                          {document.syncState === "indexing"
                            ? "同步中"
                            : document.availability === "enabled"
                              ? "可用"
                              : "停用"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary">
                      <div
                        className="flex items-center justify-end gap-2"
                        onClick={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => event.stopPropagation()}
                      >
                        <Tooltip
                          text={document.availability === "enabled" ? "停用文档" : "启用文档"}
                          placement="top"
                        >
                          <div>
                            <Toggle
                              checked={document.availability === "enabled"}
                              disabled={document.syncState === "indexing"}
                              onChange={() => {
                                updateDocument(document.id, (current) => ({
                                  ...current,
                                  availability:
                                    current.availability === "enabled" ? "disabled" : "enabled",
                                }));
                                message.success(
                                  document.availability === "enabled"
                                    ? `已停用 ${document.name}`
                                    : `已启用 ${document.name}`,
                                );
                              }}
                            />
                          </div>
                        </Tooltip>

                        <Tooltip text="文档设置" placement="top">
                          <button
                            type="button"
                            onClick={() => openDocumentSettings(document)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-text-secondary transition-all duration-150 hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
                          >
                            <Settings2 className="h-4 w-4" />
                          </button>
                        </Tooltip>

                        <Tooltip text="更多操作" placement="top">
                          <button
                            type="button"
                            onClick={() => openMoreActions(document)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-text-secondary transition-all duration-150 hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
                          >
                            <Ellipsis className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-dashed border-border bg-surface-secondary/60 px-4 py-3 text-sm text-text-secondary">
          提示：双击任意数据行可进入文档详情页，点击“添加文件”会进入分步上传表单。
        </div>

        <div className="flex flex-col gap-2 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <div>
            共 <span className="font-medium text-text-primary">{documents.length}</span> 个文档，
            当前显示 <span className="font-medium text-text-primary">{filteredDocuments.length}</span> 个
          </div>
          <div>
            可用文档 <span className="font-medium text-text-primary">{enabledCount}</span> 个 ·
            总召回 <span className="font-medium text-text-primary">{totalHits}</span> 次
          </div>
        </div>
      </Card>
    </div>
  );
}
