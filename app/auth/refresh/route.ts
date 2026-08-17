import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseConfig } from "@/src/lib/env";
import { refreshSession } from "@/src/lib/auth/session-refresh";

const SESSION_MAX_AGE = 60 * 60 * 24 * 365;
const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

const json = (body: unknown, status: number) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

export async function POST() {
  const jar = await cookies();
  const refreshToken = jar.get("madar-refresh-token")?.value;
  if (!refreshToken) return json({ status: "unauthenticated" }, 401);

  const { url, key } = supabaseConfig();
  const result = await refreshSession(url, key, refreshToken);

  if (result.kind === "refreshed") {
    jar.set(
      "madar-access-token",
      result.session.access_token,
      cookieOptions(result.session.expires_in || 3600),
    );
    jar.set(
      "madar-refresh-token",
      result.session.refresh_token,
      cookieOptions(SESSION_MAX_AGE),
    );
    return json({ status: "authenticated" }, 200);
  }

  if (result.kind === "invalid") {
    jar.set("madar-access-token", "", cookieOptions(0));
    jar.set("madar-refresh-token", "", cookieOptions(0));
    return json({ status: "unauthenticated" }, 401);
  }

  const response = json({ status: "recovering" }, 503);
  response.headers.set("Retry-After", "2");
  return response;
}
