import React from "react";

type SkeletonRadius = "control" | "panel" | "full";

interface SkeletonProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  radius?: SkeletonRadius;
  animate?: boolean;
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lineClassName?: string;
  lastLineWidth?: number | string;
}

interface SkeletonCircleProps {
  size?: number | string;
  className?: string;
  animate?: boolean;
}

interface SkeletonCardProps {
  lines?: number;
  showAvatar?: boolean;
  showMeta?: boolean;
  className?: string;
}

const radiusClassNames: Record<SkeletonRadius, string> = {
  control: "rounded-ui-control",
  panel: "rounded-ui-panel",
  full: "rounded-full",
};

const resolveStyleSize = (value?: number | string) => {
  if (typeof value === "number") {
    return `${value}px`;
  }

  return value;
};

function SkeletonBlock({
  className = "",
  width = "100%",
  height = 16,
  radius = "control",
  animate = true,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        "relative overflow-hidden bg-surface-secondary",
        radiusClassNames[radius],
        animate ? "animate-pulse" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width: resolveStyleSize(width),
        height: resolveStyleSize(height),
      }}
    />
  );
}

function SkeletonText({
  lines = 3,
  className = "",
  lineClassName = "",
  lastLineWidth = "62%",
}: SkeletonTextProps) {
  const normalizedLines = Math.max(1, lines);

  return (
    <div className={["space-y-2", className].filter(Boolean).join(" ")}>
      {Array.from({ length: normalizedLines }).map((_, index) => (
        <SkeletonBlock
          key={index}
          height={14}
          width={index === normalizedLines - 1 ? lastLineWidth : "100%"}
          className={lineClassName}
        />
      ))}
    </div>
  );
}

function SkeletonCircle({
  size = 36,
  className = "",
  animate = true,
}: SkeletonCircleProps) {
  return (
    <SkeletonBlock
      width={size}
      height={size}
      radius="full"
      animate={animate}
      className={className}
    />
  );
}

function SkeletonCard({
  lines = 3,
  showAvatar = false,
  showMeta = true,
  className = "",
}: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        "rounded-ui-panel border border-border bg-surface-primary p-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start gap-3">
        {showAvatar ? <SkeletonCircle /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <SkeletonBlock width="42%" height={16} />
            {showMeta ? <SkeletonBlock width={72} height={12} /> : null}
          </div>
          <SkeletonText lines={lines} className="mt-3" lastLineWidth="68%" />
        </div>
      </div>
    </div>
  );
}

const Skeleton = Object.assign(SkeletonBlock, {
  Text: SkeletonText,
  Circle: SkeletonCircle,
  Card: SkeletonCard,
});

export default Skeleton;
export { SkeletonBlock, SkeletonText, SkeletonCircle, SkeletonCard };
