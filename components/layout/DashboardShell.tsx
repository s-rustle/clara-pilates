"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const titleMap: Record<string, string> = {
  "/": "Dashboard",
  "/study": "Study",
  "/quiz": "Quiz",
  "/sessions": "Sessions",
  "/learn": "Learn",
  "/cues": "Practice Cues",
  "/hours": "Hours",
  "/curriculum": "Curriculum",
  "/settings": "Settings",
};

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = titleMap[pathname] ?? "Dashboard";

  return (
    <div className="relative z-10 min-h-screen bg-clara-bg">
      <Sidebar />
      <div className="relative z-10 min-w-0 max-w-full pl-60">
        <TopBar title={title} />
        <main className="min-h-[calc(100vh-4rem)] min-w-0 max-w-full overflow-x-auto overflow-y-auto bg-clara-bg p-4 sm:p-6 md:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
