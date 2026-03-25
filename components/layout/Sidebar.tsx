"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  BookOpen,
  ClipboardList,
  Calendar,
  GraduationCap,
  Mic,
  Clock,
  FolderOpen,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "./Wordmark";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/study", label: "Study", icon: BookOpen },
  { href: "/quiz", label: "Quiz", icon: ClipboardList },
  { href: "/sessions", label: "Sessions", icon: Calendar },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/cues", label: "Practice Cues", icon: Mic },
  { href: "/hours", label: "Hours", icon: Clock },
  { href: "/curriculum", label: "Curriculum", icon: FolderOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="@container fixed left-0 top-0 z-40 flex h-screen w-[140px] flex-col border-r border-clara-border bg-clara-surface">
      {/* Same vertical band as TopBar (h-16) so “Clara” can scale into that space */}
      <div className="flex min-h-16 items-center px-3 py-2">
        <Wordmark variant="sidebar" />
      </div>
      <div className="border-b-[4px] border-clara-primary" aria-hidden />

      <nav className="flex flex-1 flex-col overflow-y-auto px-0 pt-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 border-r-[3px] px-2 py-2 text-[11px] font-medium leading-tight transition-colors ${
                isActive
                  ? "border-clara-primary bg-clara-tint text-clara-primary"
                  : "border-transparent text-[#555555] hover:bg-clara-bg hover:text-clara-deep"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-clara-border p-0">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 px-2 py-2.5 text-left text-[11px] text-clara-muted transition-colors hover:bg-clara-bg hover:text-clara-deep"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
