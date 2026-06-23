import Header from "./Header";

interface SettingsPageLayoutProps {
  miniTitle: string;
  title: string;
  description?: string;
  slot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  contentClassName?: string;
  containerClassName?: string;
  scrollBody?: boolean;
}

export default function SettingsPageLayout({
  miniTitle,
  title,
  description,
  slot,
  children,
  className = "",
  bodyClassName = "",
  contentClassName = "",
  containerClassName = "",
  scrollBody = true,
}: SettingsPageLayoutProps) {
  const containerClasses = ["mx-auto w-full max-w-[1180px]", containerClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden ${className}`}
    >
      <div className={`shrink-0 px- ${containerClasses}`}>
        <Header
          miniTitle={miniTitle}
          title={title}
          description={description}
          slot={slot}
        />
      </div>

      <div
        className={[
          "min-h-0 flex-1",
          scrollBody ? "stable-scrollbar overflow-y-auto" : "",
          bodyClassName,
        ].join(" ")}
      >
        <div
          className={`flex h-full min-h-0 flex-col px-2 pb-6 ${containerClasses} ${contentClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
