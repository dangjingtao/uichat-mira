import React from "react";

interface TooltipProps {
  children: React.ReactNode;
  text: string;
  placement?: "top" | "bottom" | "left" | "right";
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  text,
  placement = "right",
}) => {
  const placementClasses = {
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-text-primary",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-text-primary",
    left: "right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-text-primary",
    right: "left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-text-primary",
  };

  return (
    <div className="group relative flex items-center">
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap opacity-0 transition duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100 ${placementClasses[placement]}`}
      >
        <div className="rounded-lg bg-text-primary px-2.5 py-1.5 text-xs text-text-inverted shadow-shadow-lg">
          {text}
          <div className={`absolute ${arrowClasses[placement]}`}></div>
        </div>
      </div>
    </div>
  );
};

export default Tooltip;
