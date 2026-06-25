import { CircleUserRound } from "lucide-react";

interface RoleAvatarProps {
  src?: string | null;
  name: string;
  sizeClassName: string;
}

export default function RoleAvatar({
  src,
  name,
  sizeClassName,
}: RoleAvatarProps) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center rounded-full border border-border bg-surface-secondary text-icon-secondary ${sizeClassName}`}
      >
        <CircleUserRound className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className={`rounded-full border border-border bg-surface-secondary object-cover ${sizeClassName}`}
      draggable={false}
    />
  );
}
