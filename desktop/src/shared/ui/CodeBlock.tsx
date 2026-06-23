import React from "react";
import Card from "./Card";

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "terminal";
}

const toneClassNames = {
  default: "border-border bg-surface-secondary/55 text-text-primary",
  terminal: "border-border bg-surface-secondary/55 text-text-primary",
} as const;

export default function CodeBlock({
  children,
  className = "",
  tone = "default",
}: CodeBlockProps) {
  return (
    <Card
      className={`overflow-hidden px-3.5 py-3 font-mono text-xs leading-6 ${toneClassNames[tone]} ${className}`}
    >
      {children}
    </Card>
  );
}
