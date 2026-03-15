"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  BookOpen,
  ClipboardList,
  Calendar,
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
  {
    href: "/cues",
    label: "Practice Cues",
    icon: Mic,
    disabled: true,
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
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col bg-clara-surface">
      <div className="border-b border-clara-highlight/50 p-4">
        <Wordmark size="sm" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-clara-deep/50"
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="flex-1 text-sm">{item.label}</span>
                {item.badge && (
                  <Badge variant="grey" className="text-[10px]">
                    {item.badge}
                  </Badge>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-clara-highlight text-clara-primary"
                  : "text-clara-deep hover:bg-clara-highlight"
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-clara-highlight/50 p-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-clara-deep transition-colors hover:bg-clara-highlight"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
