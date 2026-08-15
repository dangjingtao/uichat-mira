import Skeleton from "@/shared/ui/Skeleton";

export default function DevelopmentPageSkeleton() {
  return (
    <div
      aria-busy="true"
      data-testid="development-page-skeleton"
      className="flex h-full min-h-0 flex-col"
    >
      <Skeleton.Card className="min-h-[220px] flex-1" lines={4} />
    </div>
  );
}
