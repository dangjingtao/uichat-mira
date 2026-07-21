import { BookOpen, CheckCircle2, KeyRound, MousePointer2, Puzzle, Wrench } from "lucide-react";
import { Button, Drawer } from "@/shared/ui";

type GuideSectionProps = {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
};

function GuideSection({ icon, title, children }: GuideSectionProps) {
  return (
    <section className="border-b border-border pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
        {icon}
        <h3>{title}</h3>
      </div>
      <div className="mt-2 text-sm leading-6 text-text-secondary">{children}</div>
    </section>
  );
}

export default function JianXingGuideDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      closeLabel="关闭使用指南"
      closeMaskLabel="关闭使用指南"
      header={
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <BookOpen className="h-4 w-4 text-icon-secondary" />
            <h2>触界使用指南</h2>
          </div>
          <p className="text-sm leading-6 text-text-secondary">完成扩展、Native 和授权配置后，连接状态会自动同步到这里。</p>
        </div>
      }
      footer={<Button size="sm" variant="secondary" onClick={onClose}>关闭</Button>}
    >
      <div className="space-y-4">
        <GuideSection icon={<Puzzle className="h-4 w-4 text-icon-secondary" />} title="安装触界扩展">
          下载并在 Chrome 扩展管理页安装、启用触界。开发调试时加载项目的扩展根目录，不加载内部的 <code>extension</code> 子目录。
        </GuideSection>
        <GuideSection icon={<Wrench className="h-4 w-4 text-icon-secondary" />} title="注册 Native Messaging">
          在本页点击“安装 Native”或“修复 Native”。“Native 已安装”只代表 Chrome 可以找到本机连接组件，不代表扩展已经在线。
        </GuideSection>
        <GuideSection icon={<KeyRound className="h-4 w-4 text-icon-secondary" />} title="完成扩展授权">
          点击“浏览器扩展授权”生成一次性授权码，在 Chrome 的触界侧栏粘贴并授权。扩展授权后会主动连接 Native Messaging 和 Mira。
        </GuideSection>
        <GuideSection icon={<CheckCircle2 className="h-4 w-4 text-icon-secondary" />} title="确认连接状态">
          “等待扩展”表示 Mira 已就绪，正在等待 Chrome 扩展接入；只有显示“扩展已连接”后，见行和剪藏规则同步才可使用。
        </GuideSection>
        <GuideSection icon={<MousePointer2 className="h-4 w-4 text-icon-secondary" />} title="使用见行与剪藏">
          见行先用“看”读取页面和元素引用，再执行翻页、点击、填写或传输。剪藏用于用户主动采集；网站规则只影响对应网站的正文和图片提取。
        </GuideSection>
      </div>
    </Drawer>
  );
}
