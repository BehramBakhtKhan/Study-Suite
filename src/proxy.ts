import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_ROUTES = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/refresh",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip public auth endpoints
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // 2. Extract token from HTTP-only cookie first, fallback to Authorization header
  const cookieToken = req.cookies.get("accessToken")?.value;
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  const token = cookieToken || bearerToken;

  if (!token) {
    return NextResponse.json(
      { error: "Access token missing or invalid" },
      { status: 401 }
    );
  }

  try {
    // 3. Verify token with Web Crypto API
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
    const { payload } = await jwtVerify(token, secret);

    // 4. Forward request with attached user context headers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", (payload.userId as string) || "");
    requestHeaders.set("x-user-email", (payload.email as string) || "");
    requestHeaders.set("x-user-role", (payload.role as string) || "");

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid or expired access token" },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: ["/api/:path*"],
};