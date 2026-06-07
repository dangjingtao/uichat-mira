type FullPageStatusProps = {
  message: string;
};

export function FullPageStatus({ message }: FullPageStatusProps) {
  return (
    <main className="mx-auto mt-10 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
      {message}
    </main>
  );
}
