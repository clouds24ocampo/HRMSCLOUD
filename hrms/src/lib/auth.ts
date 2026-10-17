import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findSession } from "@/lib/session";
import { canAccess } from "@/lib/roles";
import { isDbDown } from "@/lib/db-health";

export const SESSION_COOKIE = "hrms_session";

// In production, cookies are secure by default, but allowed over plain HTTP if COOKIE_SECURE=false or APP_URL is http://
export function isCookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.APP_URL?.startsWith("http://")) return false;
  return process.env.NODE_ENV === "production";
}

export const getUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await findSession(token);
  } catch (e) {
    if (isDbDown(e)) redirect("/unavailable"); // a clear page, not a stack trace
    throw e;
  }
});

// Public pages (landing, login, register): send real signed-in users to the dashboard.
export async function redirectIfSignedIn() {
  if (await getUser()) redirect("/dashboard");
}

// Call at the top of every protected page/action. Server-side check; proxy.ts is only a shortcut.
export async function requireUser(path: string) {
  const user = await getUser();
  if (!user) redirect("/login");
  // Temporary password: nothing else is reachable until the user picks their own.
  if (user.mustChangePassword && path !== "/change-password") redirect("/change-password");
  if (!canAccess(user.role.key, path)) redirect("/dashboard?denied=1");
  return user;
}
