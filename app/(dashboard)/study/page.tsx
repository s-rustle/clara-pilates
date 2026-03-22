import { Suspense } from "react";
import StudyPageClient from "@/components/study/StudyPageClient";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function StudyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[200px] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <StudyPageClient />
    </Suspense>
  );
}
