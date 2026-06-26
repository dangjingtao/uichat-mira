import { getApiBaseUrl } from "@/shared/platform/desktopRuntime";

export default function DevelopmentApiDocs() {
  const docsUrl = `${getApiBaseUrl()}/api-docs`;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <iframe src={docsUrl} title="API Docs" className="h-full w-full" />
    </div>
  );
}
