declare module "@impelsys/react-mentions" {
  import type { ComponentClass, CSSProperties } from "react";
  import type {
    MentionsInputProps as BaseMentionsInputProps,
    MentionsInputStyle as BaseMentionsInputStyle,
  } from "react-mentions";

  export * from "react-mentions";

  export interface MentionsInputStyle
    extends Omit<BaseMentionsInputStyle, "highlighter"> {
    highlighter?: CSSProperties & {
      substring?: CSSProperties;
    };
  }

  export interface MentionsInputProps
    extends Omit<BaseMentionsInputProps, "style"> {
    style?: MentionsInputStyle;
  }

  export const MentionsInput: ComponentClass<MentionsInputProps>;
}
