import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import {
  getAuthSession,
  getExamTargetDateForUser,
} from "@/lib/supabase/request-cache";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getAuthSession();

  if (!user) {
    redirect("/login");
  }

  const examTargetDate = await getExamTargetDateForUser(user.id);

  return (
    <DashboardShell examTargetDate={examTargetDate}>{children}</DashboardShell>
  );
}
