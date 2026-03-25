import { cache } from "react";
import { createClient } from "./server";

/** One Supabase server client per request (deduped). */
export const getServerSupabase = cache(createClient);

/** One auth lookup per request when layout + page both need the user. */
export const getAuthSession = cache(async () => {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: data.user, error };
});

/** Dedupes profile row when layout and page both need exam_target_date. */
export const getExamTargetDateForUser = cache(async (userId: string) => {
  const supabase = await getServerSupabase();
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("exam_target_date")
    .eq("id", userId)
    .maybeSingle();
  return (profileRow?.exam_target_date as string | null | undefined) ?? null;
});
