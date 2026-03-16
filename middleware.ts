import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PATHS = [
  "/",
  "/study",
  "/quiz",
  "/cues",
  "/sessions",
  "/learn",
  "/hours",
  "/curriculum",
  "/settings",
];

function isProtectedPath(pathname: string): boolean {
  if (PROTECTED_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/dashboard")) return true;
  if (pathname.startsWith("/api/agents/")) return true;
  if (pathname.startsWith("/api/hours")) return true;
  if (pathname.startsWith("/api/sessions")) return true;
  if (pathname.startsWith("/api/ingest")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const { response, user } = await updateSession(request);

  if (isProtectedPath(pathname)) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  } else if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
