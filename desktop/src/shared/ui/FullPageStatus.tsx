type FullPageStatusProps = {
  message: string;
};

export function FullPageStatus({ message }: FullPageStatusProps) {
  return (
    <main className="mx-auto mt-16 flex max-w-lg items-center justify-center rounded-ui-panel border border-border bg-surface-primary px-6 py-5 text-sm text-text-secondary shadow-shadow-sm">
      <span className="font-medium text-text-primary">{message}</span>
    </main>
  );
}
