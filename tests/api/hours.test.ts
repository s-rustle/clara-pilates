import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockUser = { id: "test-user-123" };

const userLogs = [
  {
    id: "log-1",
    user_id: mockUser.id,
    category: "Mat 1",
    sub_type: "Practical",
    session_date: "2024-01-15",
    duration_minutes: 60,
    notes: null,
    status: "logged",
    created_at: "2024-01-15T00:00:00Z",
  },
];

const mockSupabase = {
  auth: {
    getUser: () =>
      Promise.resolve({
        data: { user: mockUser },
        error: null,
      }),
  },
  from: (table: string) => {
    if (table !== "hour_logs") {
      const chain = Promise.resolve({ data: null, error: null });
      return {
        select: () => ({ eq: () => ({ order: () => chain }) }),
      };
    }
    return {
      select: (cols?: string) => {
        if (cols === "session_date") {
          return {
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { session_date: "2024-01-01" },
                    error: null,
                  }),
              }),
            }),
          };
        }
        const result = Promise.resolve({ data: userLogs, error: null });
        const orderResult = Object.assign(result, {
          eq: () => orderResult,
          gte: () => orderResult,
          lte: () => orderResult,
        });
        return {
          eq: () => ({
            order: () => orderResult,
          }),
        };
      },
      insert: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: "log-new",
                user_id: mockUser.id,
                category: "Mat 1",
                sub_type: "Practical",
                session_date: "2024-01-15",
                duration_minutes: 60,
                notes: null,
                status: "logged",
                created_at: "2024-01-15T00:00:00Z",
              },
              error: null,
            }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "log-1",
                    user_id: mockUser.id,
                    category: "Mat 1",
                    sub_type: "Practical",
                    session_date: "2024-01-15",
                    duration_minutes: 60,
                    notes: null,
                    status: "complete",
                    created_at: "2024-01-15T00:00:00Z",
                  },
                  error: null,
                }),
            }),
          }),
        }),
      }),
    };
  },
};

const mockServiceClient = {
  from: () => ({
    upsert: () => Promise.resolve({ error: null }),
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
  createServiceClient: vi.fn(() => mockServiceClient),
}));

describe("Hours API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST", () => {
    it("creates a record correctly", async () => {
      const { POST } = await import("@/app/api/hours/route");
      const req = new NextRequest("http://localhost/api/hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "Mat 1",
          sub_type: "Practical",
          session_date: "2024-01-15",
          duration_minutes: 60,
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        category: "Mat 1",
        sub_type: "Practical",
        session_date: "2024-01-15",
        duration_minutes: 60,
        user_id: mockUser.id,
      });
    });

    it("returns 400 when required fields missing", async () => {
      const { POST } = await import("@/app/api/hours/route");
      const req = new NextRequest("http://localhost/api/hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "Mat 1" }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("GET", () => {
    it("returns only the authenticated user's records", async () => {
      const { GET } = await import("@/app/api/hours/route");
      const req = new NextRequest("http://localhost/api/hours");

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(
        data.data.every((l: { user_id: string }) => l.user_id === mockUser.id)
      ).toBe(true);
    });
  });

  describe("PATCH", () => {
    it("correctly updates status", async () => {
      const { PATCH } = await import("@/app/api/hours/route");
      const req = new NextRequest("http://localhost/api/hours", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "log-1", status: "complete" }),
      });

      const res = await PATCH(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("complete");
    });
  });
});
