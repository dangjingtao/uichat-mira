import { Focus, Plus, Save, Trash2, X } from "lucide-react";
import { Alert, Button, Drawer, IconButton, NumberInput, Select, Switch, TextInput } from "@/shared/ui";
import type { ClipRule, ClipRules } from "@/shared/api/webbridge";

interface ClipRuleDrawerProps {
  open: boolean;
  onClose: () => void;
  ruleHost: string;
  ruleForm: ClipRule;
  clipRules: ClipRules;
  rulesSaving: boolean;
  regionPicking: "include" | "exclude" | null;
  extensionConnected: boolean;
  rulesError: string;
  rulesMessage: string;
  onRuleHostChange: (value: string) => void;
  onRuleFormChange: (patch: Partial<ClipRule>) => void;
  onPickRuleRegion: (kind: "include" | "exclude") => void;
  onRemoveExcludeRegion: (selector: string) => void;
  onDelete: () => void;
  onSave: () => void;
}

export default function ClipRuleDrawer({
  open,
  onClose,
  ruleHost,
  ruleForm,
  clipRules,
  rulesSaving,
  regionPicking,
  extensionConnected,
  rulesError,
  rulesMessage,
  onRuleHostChange,
  onRuleFormChange,
  onPickRuleRegion,
  onRemoveExcludeRegion,
  onDelete,
  onSave,
}: ClipRuleDrawerProps) {
  const hasSavedRule = Boolean(clipRules[ruleHost]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={620}
      closeLabel="关闭规则编辑"
      closeMaskLabel="关闭规则编辑"
      header={
        <div>
          <div className="text-sm font-semibold text-text-primary">
            {hasSavedRule ? "编辑网站规则" : "新增网站规则"}
          </div>
          <div className="mt-1 text-xs text-text-secondary">
            配置网页正文、排除区域和图片提取条件
          </div>
        </div>
      }
      footer={
        <>
          <Button size="sm" variant="danger-ghost" onClick={onDelete} disabled={rulesSaving || !hasSavedRule}>
            <Trash2 className="h-4 w-4" />删除规则
          </Button>
          <Button size="sm" variant="primary" onClick={onSave} disabled={rulesSaving || !extensionConnected}>
            <Save className="h-4 w-4" />{rulesSaving ? "保存中…" : "保存网站规则"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {rulesError ? <Alert variant="danger" title="规则同步失败">{rulesError}</Alert> : null}
        {rulesMessage ? <Alert variant="success" title="规则状态">{rulesMessage}</Alert> : null}

        <TextInput
          label="编辑网站域名"
          value={ruleHost}
          onChange={onRuleHostChange}
          placeholder="例如 example.com"
          compact
        />
        <TextInput
          label="URL 匹配规则（可选）"
          value={ruleForm.urlPattern || ""}
          onChange={(value) => onRuleFormChange({ urlPattern: value })}
          placeholder={ruleForm.urlPatternMode === "regex" ? "例如 ^https://example\\.com/article/.*" : "例如 https://example.com/article/*"}
          compact
        />
        <Select
          label="匹配方式"
          value={ruleForm.urlPatternMode || "wildcard"}
          onChange={(value) => onRuleFormChange({ urlPatternMode: value as "wildcard" | "regex" })}
          options={[{ value: "wildcard", label: "通配符" }, { value: "regex", label: "正则" }]}
        />
        <p className="text-xs leading-5 text-text-tertiary">
          留空匹配该网站全部页面。通配符中 `*` 匹配任意长度文本，`?` 匹配一个字符；正则模式填写 JavaScript 正则表达式，不填写标志。
        </p>

        <div className="flex items-center justify-between rounded-ui-control border border-border bg-surface-secondary px-3 py-2">
          <div>
            <div className="text-sm font-medium text-text-primary">启用当前规则</div>
            <div className="text-xs text-text-tertiary">停用后该网站回到默认提取</div>
          </div>
          <Switch checked={ruleForm.enabled} onChange={() => onRuleFormChange({ enabled: !ruleForm.enabled })} ariaLabel="启用当前网站规则" size="sm" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-text-secondary">正文区域</span>
            <Button size="xs" variant="outline" onClick={() => onPickRuleRegion("include")} disabled={regionPicking !== null || !extensionConnected}>
              <Focus className="h-4 w-4" />{regionPicking === "include" ? "等待点选…" : ruleForm.includeSelector ? "重新选择" : "选择正文区域"}
            </Button>
          </div>
          <div className="min-h-16 rounded-ui-control border border-border bg-surface-secondary px-3 py-2">
            {ruleForm.includeRegion ? <>
              <div className="text-sm font-medium text-text-primary">{ruleForm.includeRegion.tag} · {ruleForm.includeRegion.elementCount} 个元素 · {ruleForm.includeRegion.imageCount} 张图片</div>
              <p className="mt-1 line-clamp-2 text-xs text-text-tertiary">{ruleForm.includeRegion.text || "所选区域没有可预览文字"}</p>
            </> : ruleForm.includeSelector ? <p className="text-sm text-text-secondary">此规则来自旧版配置，请重新点选正文区域以生成可读摘要。</p> : <p className="text-sm text-text-tertiary">尚未选择，保存后该网站仍使用默认正文判断。</p>}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-text-secondary">排除区域</span>
            <Button size="xs" variant="outline" onClick={() => onPickRuleRegion("exclude")} disabled={regionPicking !== null || !extensionConnected}>
              <Plus className="h-4 w-4" />{regionPicking === "exclude" ? "等待点选…" : "添加排除区域"}
            </Button>
          </div>
          <div className="space-y-1.5 rounded-ui-control border border-border bg-surface-secondary p-2">
            {(ruleForm.excludeRegions || ruleForm.excludeSelectors.map((selector) => ({ selector, summary: undefined }))).map((region, index) => (
              <div key={region.selector} className="flex items-start gap-2 rounded-ui-control bg-surface-primary px-2.5 py-2">
                <div className="min-w-0 flex-1"><div className="text-xs font-medium text-text-primary">排除区域 {index + 1} · {region.summary?.tag || "网页区域"}</div><p className="mt-0.5 truncate text-xs text-text-tertiary">{region.summary?.text || "已选择网页区域"}</p></div>
                <IconButton size="xs" ariaLabel={`删除排除区域 ${index + 1}`} onClick={() => onRemoveExcludeRegion(region.selector)}><X className="h-3.5 w-3.5" /></IconButton>
              </div>
            ))}
            {!(ruleForm.excludeRegions || ruleForm.excludeSelectors.map((selector) => ({ selector, summary: undefined }))).length ? <p className="px-1 py-2 text-xs text-text-tertiary">没有排除区域</p> : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <NumberInput label="图片最小宽度" value={ruleForm.imagePolicy.minWidth} onChange={(value) => onRuleFormChange({ imagePolicy: { ...ruleForm.imagePolicy, minWidth: value } })} compact />
          <NumberInput label="图片最小高度" value={ruleForm.imagePolicy.minHeight} onChange={(value) => onRuleFormChange({ imagePolicy: { ...ruleForm.imagePolicy, minHeight: value } })} compact />
          <NumberInput label="图片数量上限" value={ruleForm.imagePolicy.maxCount} onChange={(value) => onRuleFormChange({ imagePolicy: { ...ruleForm.imagePolicy, maxCount: value } })} compact />
        </div>
      </div>
    </Drawer>
  );
}
