import { describe, it, expect } from "vitest";
import type { HourLog } from "@/types";
import {
  calculateTotalHours,
  calculatePracticalHours,
  calculateScheduledHours,
  calculateGaps,
  formatHours,
  getProgressPercent,
} from "@/lib/utils/hours";

describe("calculateTotalHours", () => {
  it("sums duration_minutes for logged and complete status only", () => {
    const logs: HourLog[] = [
      {
        id: "1",
        user_id: "u1",
        category: "Mat 1",
        sub_type: "Practical",
        session_date: "2024-01-15",
        duration_minutes: 60,
        notes: null,
        status: "logged",
        created_at: "",
      },
      {
        id: "2",
        user_id: "u1",
        category: "Reformer 1",
        sub_type: "Practical",
        session_date: "2024-01-16",
        duration_minutes: 90,
        notes: null,
        status: "complete",
        created_at: "",
      },
      {
        id: "3",
        user_id: "u1",
        category: "Mat 2",
        sub_type: "Theory",
        session_date: "2024-01-20",
        duration_minutes: 120,
        notes: null,
        status: "scheduled",
        created_at: "",
      },
    ];
    expect(calculateTotalHours(logs)).toBe(2.5); // 60 + 90 = 150 min = 2.5 h
  });

  it("returns 0 for empty logs", () => {
    expect(calculateTotalHours([])).toBe(0);
  });

  it("returns 0 when all logs are scheduled", () => {
    const logs: HourLog[] = [
      {
        id: "1",
        user_id: "u1",
        category: "Mat 1",
        sub_type: "Practical",
        session_date: "2024-02-01",
        duration_minutes: 60,
        notes: null,
        status: "scheduled",
        created_at: "",
      },
    ];
    expect(calculateTotalHours(logs)).toBe(0);
  });
});

describe("calculatePracticalHours", () => {
  it("sums mat practical hours only", () => {
    const logs: HourLog[] = [
      {
        id: "1",
        user_id: "u1",
        category: "Mat 1",
        sub_type: "Practical",
        session_date: "2024-01-15",
        duration_minutes: 60,
        notes: null,
        status: "logged",
        created_at: "",
      },
      {
        id: "2",
        user_id: "u1",
        category: "Mat 2",
        sub_type: "Practical",
        session_date: "2024-01-16",
        duration_minutes: 45,
        notes: null,
        status: "complete",
        created_at: "",
      },
      {
        id: "3",
        user_id: "u1",
        category: "Mat 1",
        sub_type: "Theory",
        session_date: "2024-01-17",
        duration_minutes: 30,
        notes: null,
        status: "logged",
        created_at: "",
      },
    ];
    expect(calculatePracticalHours(logs, "mat")).toBe(1.8); // 60 + 45 = 105 min = 1.75 -> 1.8
  });

  it("sums reformer practical hours from Reformer 1/2/3", () => {
    const logs: HourLog[] = [
      {
        id: "1",
        user_id: "u1",
        category: "Reformer 1",
        sub_type: "Practical",
        session_date: "2024-01-15",
        duration_minutes: 60,
        notes: null,
        status: "logged",
        created_at: "",
      },
    ];
    expect(calculatePracticalHours(logs, "reformer")).toBe(1);
  });

  it("sums apparatus practical hours from Trapeze Cadillac, Chair, Barrels", () => {
    const logs: HourLog[] = [
      {
        id: "1",
        user_id: "u1",
        category: "Trapeze Cadillac",
        sub_type: "Practical",
        session_date: "2024-01-15",
        duration_minutes: 90,
        notes: null,
        status: "logged",
        created_at: "",
      },
    ];
    expect(calculatePracticalHours(logs, "apparatus")).toBe(1.5);
  });
});

describe("calculateScheduledHours", () => {
  it("sums only scheduled status", () => {
    const logs: HourLog[] = [
      {
        id: "1",
        user_id: "u1",
        category: "Mat 1",
        sub_type: "Practical",
        session_date: "2024-02-01",
        duration_minutes: 60,
        notes: null,
        status: "scheduled",
        created_at: "",
      },
      {
        id: "2",
        user_id: "u1",
        category: "Reformer 1",
        sub_type: "Practical",
        session_date: "2024-02-02",
        duration_minutes: 90,
        notes: null,
        status: "scheduled",
        created_at: "",
      },
    ];
    expect(calculateScheduledHours(logs)).toBe(2.5);
  });
});

describe("calculateGaps", () => {
  it("returns remaining hours needed per target", () => {
    const logs: HourLog[] = [
      {
        id: "1",
        user_id: "u1",
        category: "Mat 1",
        sub_type: "Practical",
        session_date: "2024-01-15",
        duration_minutes: 60,
        notes: null,
        status: "logged",
        created_at: "",
      },
    ];
    const gaps = calculateGaps(logs);
    expect(gaps.total).toBe(535); // 536 - 1
    expect(gaps.mat).toBe(69); // 70 - 1
  });

  it("returns 0 for gaps when target met or exceeded", () => {
    const logs: HourLog[] = Array.from({ length: 8 }, (_, i) => ({
      id: `${i}`,
      user_id: "u1",
      category: "Mat 1",
      sub_type: "Practical",
      session_date: "2024-01-15",
      duration_minutes: 525, // 70 hours = 4200 min, so 8 entries of 525 = 70h
      notes: null,
      status: "logged" as const,
      created_at: "",
    }));
    const gaps = calculateGaps(logs);
    expect(gaps.mat).toBe(0);
  });
});

describe("formatHours", () => {
  it("formats hours and minutes", () => {
    expect(formatHours(0)).toBe("0m");
    expect(formatHours(1)).toBe("1h");
    expect(formatHours(1.5)).toBe("1h 30m");
    expect(formatHours(0.25)).toBe("15m");
  });
});

describe("getProgressPercent", () => {
  it("returns correct percentage", () => {
    expect(getProgressPercent(50, 100)).toBe(50);
    expect(getProgressPercent(268, 536)).toBe(50);
  });

  it("caps at 100", () => {
    expect(getProgressPercent(150, 100)).toBe(100);
  });

  it("returns 0 for zero target", () => {
    expect(getProgressPercent(50, 0)).toBe(0);
  });
});
