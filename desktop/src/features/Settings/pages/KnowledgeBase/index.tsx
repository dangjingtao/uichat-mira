// src/pages/SettingsAccount.tsx
import MinimalTable from "@/shared/ui/Table";

export default function SettingsAccount() {
  return (
    <div className="mx-auto max-w-2xl min-w-[64rem] px-4 py-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          知识库
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          结合实时检索与生成模型，动态引入外部知识库，解决大模型信息滞后与幻觉问题，提升生成内容真实性。
        </p>

        <MinimalTable
          columns={[
            { header: "文件名", accessorKey: "fileName" },
            { header: "知识库大小", accessorKey: "size" },
            { header: "创建时间", accessorKey: "created" },
          ]}
          data={[
            {
              id: "1",
              fileName: "deepseek-r1",
              size: 128000,
              created: "2026-03-01",
            },
            {
              id: "2",
              fileName: "llama3.2",
              size: 64000,
              created: "2026-03-05",
            },
          ]}
        />
      </div>
    </div>
  );
}
