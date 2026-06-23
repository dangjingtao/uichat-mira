import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { useEffect, useRef } from "react";

type MarkdownEditorProps = {
  initialValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function MarkdownEditorInner({
  initialValue = "",
  onChange,
  placeholder,
  disabled = false,
}: Omit<MarkdownEditorProps, "className">) {
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(initialValue);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEditor(
    (root) => {
      const editor = new Crepe({
        root,
        defaultValue: initialValueRef.current,
        features: {
          [CrepeFeature.BlockEdit]: false,
          [CrepeFeature.Toolbar]: false,
          [CrepeFeature.TopBar]: false,
          [CrepeFeature.LinkTooltip]: false,
        },
        featureConfigs: {
          [CrepeFeature.Placeholder]: {
            mode: "doc",
            text: placeholder ?? "",
          },
        },
      });

      editor.on((listener) => {
        listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            onChangeRef.current?.(markdown);
          }
        });
      });

      editor.setReadonly(disabled);
      return editor;
    },
    [disabled, placeholder],
  );

  return <Milkdown />;
}

function MarkdownEditor({
  initialValue = "",
  onChange,
  placeholder,
  disabled = false,
  className = "",
}: MarkdownEditorProps) {
  return (
    <div
      className={`role-markdown-editor flex min-h-0 flex-col rounded-ui-panel  bg-surface-primary ${className}`}
    >
      <MilkdownProvider>
        <MarkdownEditorInner
          initialValue={initialValue}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
        />
      </MilkdownProvider>
    </div>
  );
}

export default MarkdownEditor;
