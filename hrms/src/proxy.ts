import { NextResponse, type NextRequest } from "next/server";

// Pages anyone may open. Signed-in users are sent to the dashboard by redirectIfSignedIn() in the page itself:
// a cookie alone may be stale (expired, or revoked by a password change), and redirecting on it would loop.
const PUBLIC = ["/", "/login", "/register", "/unavailable"];

// Optimistic redirect only. Real checks happen in requireUser().
export function proxy(req: NextRequest) {
  const hasCookie = req.cookies.has("hrms_session");
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.includes(pathname);
  if (!isPublic && !hasCookie) return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
