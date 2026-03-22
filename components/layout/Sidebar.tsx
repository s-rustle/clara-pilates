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
import Badge from "@/components/ui/Badge";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/study", label: "Study", icon: BookOpen },
  { href: "/quiz", label: "Quiz", icon: ClipboardList },
  { href: "/sessions", label: "Sessions", icon: Calendar },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  {
    href: "/cues",
    label: "Practice Cues",
    icon: Mic,
    badge: "Phase 2",
  },
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
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-clara-highlight/80 bg-gradient-to-b from-clara-surface to-[#e3dfd4] shadow-clara-soft">
      <div className="flex min-h-[5.25rem] flex-col justify-end px-4 pb-5 pt-4">
        <Wordmark size="sm" />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-full px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-clara-highlight/90 font-semibold text-clara-primary shadow-sm"
                  : "text-clara-deep hover:bg-clara-highlight/55 hover:text-clara-primary"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <Badge variant="grey" className="text-[10px]">
                  {item.badge}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-clara-highlight/80 p-2">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-full px-3 py-2.5 text-sm text-clara-muted transition-colors hover:bg-clara-highlight/50 hover:text-clara-primary"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
