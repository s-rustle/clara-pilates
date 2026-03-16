"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorMessage from "@/components/ui/ErrorMessage";

interface DriveConnectProps {
  isConnected: boolean;
}

export default function DriveConnect({ isConnected }: DriveConnectProps) {
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/drive-url", {
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Failed to get auth URL");
      }
      window.location.href = data.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/auth/drive-disconnect", { method: "PATCH" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to disconnect");
      }
      window.location.reload();
    } catch {
      setDisconnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="green">Connected</Badge>
        <span className="text-clara-deep">Google Drive connected</span>
        <Button
          variant="secondary"
          onClick={handleDisconnect}
          disabled={disconnecting}
        >
          {disconnecting ? (
            <span className="inline-flex items-center">
              <LoadingSpinner size="sm" />
              <span className="ml-2">Disconnecting...</span>
            </span>
          ) : (
            "Disconnect"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleConnect} disabled={loading}>
        {loading ? (
          <span className="inline-flex items-center">
            <LoadingSpinner size="sm" />
            <span className="ml-2">Connecting...</span>
          </span>
        ) : (
          "Connect Google Drive"
        )}
      </Button>
      {error && <ErrorMessage message={error} />}
    </div>
  );
}
