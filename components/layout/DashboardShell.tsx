"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const titleMap: Record<string, string> = {
  "/": "Dashboard",
  "/study": "Study",
  "/quiz": "Quiz",
  "/sessions": "Session Planner",
  "/cues": "Practice Cues",
  "/hours": "Hour Tracking",
  "/curriculum": "Curriculum Manager",
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
    <div className="min-h-screen bg-clara-bg">
      <Sidebar />
      <div className="pl-56">
        <TopBar title={title} />
        <main className="min-h-[calc(100vh-4rem)] overflow-auto p-6 md:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
