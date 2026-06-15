import React, { useEffect, useRef, useState } from "react";
import Tooltip from "@/shared/ui/Tooltip";

export function OverflowTooltip({
  text,
  placement = "top",
  className,
  children,
}: {
  text: string;
  placement?: "top" | "bottom" | "left" | "right";
  className?: string;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement | HTMLParagraphElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }

    const checkOverflow = () => {
      const overflowing =
        element.scrollWidth > element.clientWidth ||
        element.scrollHeight > element.clientHeight;
      setIsOverflowing(overflowing);
    };

    checkOverflow();

    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(element);
    window.addEventListener("resize", checkOverflow);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", checkOverflow);
    };
  }, [text]);

  const content = React.cloneElement(children as React.ReactElement, {
    ref: contentRef,
    className,
  });

  if (!isOverflowing) {
    return content;
  }

  return (
    <Tooltip text={text} placement={placement}>
      {content}
    </Tooltip>
  );
}

export default OverflowTooltip;
