import { StreamdownTextPrimitive } from "@assistant-ui/react-streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
// import "katex/dist/katex.min.css";

const MarkdownText = ({ ...rest }) => (
  <StreamdownTextPrimitive plugins={{ code, math, mermaid }} {...rest} />
);

export default MarkdownText;
