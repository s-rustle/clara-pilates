import Card from "@/components/ui/Card";
import DriveConnect from "@/components/curriculum/DriveConnect";
import FolderList from "@/components/curriculum/FolderList";
import { getAuthSession } from "@/lib/supabase/request-cache";

export default async function CurriculumPage() {
  const { supabase, user } = await getAuthSession();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("google_access_token")
    .eq("id", user.id)
    .single();

  const isConnected = Boolean(
    profile?.google_access_token && profile.google_access_token.length > 0
  );

  let hasIngestedFolders = false;
  if (isConnected) {
    const { count } = await supabase
      .from("curriculum_uploads")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    hasIngestedFolders = (count ?? 0) > 0;
  }

  return (
    <div>
      <div className="mb-6 scroll-mt-6" id="drive-connect">
        <DriveConnect isConnected={isConnected} />
      </div>

      {!isConnected ? (
        <Card>
          <p className="text-clara-deep">
            Google Drive is not connected. Use{" "}
            <strong>Connect Google Drive</strong> above to reconnect or set up
            access, then you can ingest your Balanced Body materials.
          </p>
        </Card>
      ) : (
        <>
          <FolderList />
          {!hasIngestedFolders && (
            <div className="mt-4">
              <Card>
                <p className="text-clara-deep">
                  No folders ingested yet. Select a folder above to begin.
                </p>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
