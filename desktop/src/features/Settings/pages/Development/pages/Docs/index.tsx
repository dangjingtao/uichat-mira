import {
  getDesktopRuntime,
  isDesktopShell,
} from "@/shared/platform/desktopRuntime";

const getDocsSiteUrl = () => {
  const runtime = getDesktopRuntime();
  return isDesktopShell(runtime) && runtime.backendUrl
    ? `${runtime.backendUrl}/docs/`
    : "/docs/";
};

export default function DevelopmentDocs() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <iframe
        src={getDocsSiteUrl()}
        title="Developer Docs"
        className="h-full w-full"
      />
    </div>
  );
}
