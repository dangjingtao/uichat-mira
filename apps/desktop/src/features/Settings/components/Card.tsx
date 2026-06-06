function Card({
  label,
  value,
}: {
  label: string | React.ReactNode;
  value: string;
}) {
  return (
    <div
      className="
        rounded-xl
        bg-gray-50 dark:bg-white/5
        border border-gray-200 dark:border-white/10
        px-4 py-3
      "
    >
      <div className="text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{value}</div>
    </div>
  );
}

export default Card;
