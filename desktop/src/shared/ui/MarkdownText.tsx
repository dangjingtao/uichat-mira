import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import type { ComponentProps } from "react";
// import "katex/dist/katex.min.css";

type MarkdownTextProps = Omit<ComponentProps<typeof Streamdown>, "children"> & {
  children?: string;
};

const defaultMarkdownClassName =
  "max-w-none break-words text-text-primary [&_*]:border-cloudy-4/70 " +
  "[&_a]:text-text-primary [&_a]:underline [&_a]:decoration-cloudy-5 [&_a]:underline-offset-4 " +
  "[&_p]:leading-7 [&_p]:text-text-primary " +
  "[&_li]:text-text-primary [&_blockquote]:text-text-secondary";

// MarkdownText uses Streamdown directly so markdown rendering stays independent
// from any chat-runtime-specific wrappers.
const MarkdownText = ({
  children = "",
  className,
  ...rest
}: MarkdownTextProps) => (
  <Streamdown
    plugins={{ code, math, mermaid }}
    className={
      className
        ? `${defaultMarkdownClassName} ${className}`
        : defaultMarkdownClassName
    }
    {...rest}
  >
    {children}
  </Streamdown>
);

export default MarkdownText;
