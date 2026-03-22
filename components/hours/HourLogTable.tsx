"use client";

import { useState, useMemo } from "react";
import type { HourLog } from "@/types";
import { formatHours } from "@/lib/utils/hours";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { ChevronDown, ChevronUp } from "lucide-react";

const ROWS_PER_PAGE = 20;

type SortKey = "session_date" | "category" | "sub_type" | "duration_minutes" | "status" | "notes";

interface HourLogTableProps {
  logs: HourLog[];
  onStatusUpdate: () => void;
}

function truncateNotes(notes: string | null, maxLen: number): string {
  if (!notes) return "—";
  if (notes.length <= maxLen) return notes;
  return notes.slice(0, maxLen) + "…";
}

function getStatusBadgeVariant(status: string): "green" | "yellow" | "blue" {
  switch (status) {
    case "logged":
      return "green";
    case "scheduled":
      return "yellow";
    case "complete":
      return "blue";
    default:
      return "green";
  }
}

function canMarkComplete(log: HourLog): boolean {
  // Allow marking complete for scheduled (on/after date) or logged entries
  if (log.status !== "scheduled" && log.status !== "logged") return false;
  const sessionDate = new Date(log.session_date);
  const today = new Date();
  sessionDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return today >= sessionDate;
}

export default function HourLogTable({ logs, onStatusUpdate }: HourLogTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("session_date");
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const sortedLogs = useMemo(() => {
    const sorted = [...logs].sort((a, b) => {
      let aVal: string | number = a[sortKey] ?? "";
      let bVal: string | number = b[sortKey] ?? "";
      if (sortKey === "duration_minutes") {
        aVal = a.duration_minutes;
        bVal = b.duration_minutes;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.localeCompare(bVal);
        return sortAsc ? cmp : -cmp;
      }
      const cmp = (aVal as number) - (bVal as number);
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [logs, sortKey, sortAsc]);

  const totalPages = Math.ceil(sortedLogs.length / ROWS_PER_PAGE) || 1;
  const paginatedLogs = sortedLogs.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "session_date" ? false : true);
    }
    setCurrentPage(1);
  }

  async function handleMarkComplete(log: HourLog) {
    if (!canMarkComplete(log)) return;
    setError("");
    setLoadingId(log.id);
    try {
      const res = await fetch("/api/hours", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: log.id, status: "complete" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to mark complete");
        return;
      }
      onStatusUpdate();
    } catch {
      setError("Failed to mark complete. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  function SortHeader({
    label,
    columnKey,
  }: {
    label: string;
    columnKey: SortKey;
  }) {
    const isActive = sortKey === columnKey;
    return (
      <button
        type="button"
        onClick={() => handleSort(columnKey)}
        className="flex items-center gap-1 font-bold text-clara-strong hover:text-clara-deep"
      >
        {label}
        {isActive &&
          (sortAsc ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          ))}
      </button>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <p className="text-clara-deep">
          No hours logged yet. Log your first session above.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-clara-highlight">
        <table className="w-full min-w-[600px]">
          <thead className="border-b border-clara-highlight bg-clara-surface">
            <tr>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Date" columnKey="session_date" />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Category" columnKey="category" />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Sub-type" columnKey="sub_type" />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Duration" columnKey="duration_minutes" />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Status" columnKey="status" />
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Notes" columnKey="notes" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clara-highlight bg-clara-bg">
            {paginatedLogs.map((log) => (
              <tr key={log.id} className="text-sm text-clara-deep">
                <td className="px-4 py-3">{log.session_date}</td>
                <td className="px-4 py-3">{log.category}</td>
                <td className="px-4 py-3">{log.sub_type}</td>
                <td className="px-4 py-3">
                  {formatHours(log.duration_minutes / 60)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(log.status)}>
                      {log.status}
                    </Badge>
                    {canMarkComplete(log) && (
                      <Button
                        variant="secondary"
                        onClick={() => handleMarkComplete(log)}
                        disabled={loadingId === log.id}
                        className="h-7 px-2 py-1 text-xs"
                      >
                        {loadingId === log.id ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          "Mark Complete"
                        )}
                      </Button>
                    )}
                  </div>
                </td>
                <td className="max-w-[200px] truncate px-4 py-3" title={log.notes ?? undefined}>
                  {truncateNotes(log.notes, 40)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="text-clara-primary disabled:cursor-not-allowed disabled:opacity-50 hover:underline"
          >
            Previous
          </button>
          <span className="text-clara-deep">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setCurrentPage((p) => Math.min(totalPages, p + 1))
            }
            disabled={currentPage === totalPages}
            className="text-clara-primary disabled:cursor-not-allowed disabled:opacity-50 hover:underline"
          >
            Next
          </button>
        </div>
      )}

      <ErrorMessage message={error} />
    </div>
  );
}
