import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "rs_session";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap");
  if (isPublicAsset) return NextResponse.next();

  const isAuthRoute = pathname === "/auth" || pathname.startsWith("/api/auth");
  if (isAuthRoute) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL("/auth", request.url);
  const nextValue = `${pathname}${search ?? ""}`;
  loginUrl.searchParams.set("next", nextValue);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
