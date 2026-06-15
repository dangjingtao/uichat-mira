import React, { useId } from "react";
import { Tooltip as ReactTooltip } from "react-tooltip";

interface TooltipProps {
  children: React.ReactNode;
  text: string;
  placement?: "top" | "bottom" | "left" | "right";
}

const placementMap = {
  top: "top",
  bottom: "bottom",
  left: "left",
  right: "right",
} as const;

const tooltipClassName =
  "z-[120] max-w-[min(24rem,calc(100vw-2rem))] whitespace-normal break-words border border-border bg-surface-primary text-left text-[10.5px] leading-4 text-text-primary shadow-[0_10px_30px_rgba(15,23,42,0.12)]";

const tooltipArrowClassName = "border-border";

const Tooltip: React.FC<TooltipProps> = ({
  children,
  text,
  placement = "right",
}) => {
  const tooltipId = useId();

  if (!text.trim()) {
    return <>{children}</>;
  }

  return (
    <>
      <span
        data-tooltip-id={tooltipId}
        data-tooltip-content={text}
        className="inline-flex items-center"
      >
        {children}
      </span>
      <ReactTooltip
        id={tooltipId}
        place={placementMap[placement]}
        className={tooltipClassName}
        classNameArrow={tooltipArrowClassName}
        opacity={1}
        offset={8}
        delayShow={80}
        noArrow={false}
        style={{
          borderRadius: "6px",
          padding: "2.5px 6.5px",
        }}
      />
    </>
  );
};

export default Tooltip;
