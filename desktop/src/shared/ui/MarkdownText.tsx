import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { memo, type ComponentProps } from "react";
// import "katex/dist/katex.min.css";

type MarkdownTextProps = Omit<ComponentProps<typeof Streamdown>, "children"> & {
  children?: string;
  features?: "full" | "basic";
};

const defaultMarkdownClassName =
  "min-w-0 w-full max-w-none break-words [overflow-wrap:anywhere] text-text-primary [&_*]:border-cloudy-4/70 " +
  "[&_a]:text-text-primary [&_a]:underline [&_a]:decoration-cloudy-5 [&_a]:underline-offset-4 " +
  "[&_p]:leading-7 [&_p]:text-text-primary " +
  "[&_li]:text-text-primary [&_blockquote]:text-text-secondary";

const basicPlugins = {};
const fullPlugins = { code, math, mermaid };
const INTERNAL_SKILL_REPORT_MARKER =
  /<!--mira-skill-report:[a-zA-Z0-9_-]+:(?:pdf|html)-->/g;

// MarkdownText uses Streamdown directly so markdown rendering stays independent
// from any chat-runtime-specific wrappers. Internal transport markers are
// stripped before markdown rendering and are consumed by message extensions.
const MarkdownText = memo(function MarkdownText({
  children = "",
  className,
  features = "full",
  ...rest
}: MarkdownTextProps) {
  const visibleChildren = children.replace(INTERNAL_SKILL_REPORT_MARKER, "").trimEnd();
  return (
    <Streamdown
      plugins={features === "basic" ? basicPlugins : fullPlugins}
      className={
        className
          ? `${defaultMarkdownClassName} ${className}`
          : defaultMarkdownClassName
      }
      {...rest}
    >
      {visibleChildren}
    </Streamdown>
  );
});

export default MarkdownText;
