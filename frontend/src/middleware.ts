import { NextResponse, type NextRequest } from "next/server";

// Set by the backend (project3) on /auth/login and /auth/register.
const SESSION_COOKIE = "csv_enrichment_session";

export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const login = new URL("/", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
