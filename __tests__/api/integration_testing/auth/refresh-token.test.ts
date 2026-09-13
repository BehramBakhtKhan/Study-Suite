import { POST } from "@/app/api/auth/refresh-token/route";
import { prisma } from "@/lib/prisma";
import { generateRefreshToken } from "@/lib/auth/token";
import { NextRequest } from "next/server";

describe("POST /api/auth/refresh Integration Tests", () => {
  // Test 1: Missing refresh token cookie
  it("should return 401 if refresh token cookie is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Refresh token missing");
  });

  // Test 2: Invalid or expired refresh token string
  it("should return 401 if refresh token is invalid or malformed", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
    });

    req.cookies.set("refreshToken", "invalid.jwt.token");

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Invalid or expired refresh token");
  });

  // Test 3: User no longer exists in database
  it("should return 401 if user encoded in token no longer exists", async () => {
    const fakeUserId = "00000000-0000-0000-0000-000000000000";
    const validRefreshToken = generateRefreshToken(fakeUserId);

    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
    });

    req.cookies.set("refreshToken", validRefreshToken);

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("User no longer exists");
  });

  // Test 4: Successful token refresh & cookie rotation
  it("should return 200 and set new tokens when refresh token is valid", async () => {
    // 1. Create user in PostgreSQL
    const user = await prisma.user.create({
      data: {
        username: "refreshtest",
        email: "refresh@example.com",
        passwordHash: "hashedpassword123",
      },
    });

    // 2. Generate valid initial refresh token
    const initialRefreshToken = generateRefreshToken(user.id);

    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
    });

    req.cookies.set("refreshToken", initialRefreshToken);

    // 3. Execute route handler
    const res = await POST(req);
    const body = await res.json();

    // 4. Assert response
    expect(res.status).toBe(200);
    expect(body.message).toBe("Token refreshed successfully");

    // 5. Verify rotated cookies in Set-Cookie headers
    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).toBeDefined();
    expect(setCookieHeader).toContain("accessToken");
    expect(setCookieHeader).toContain("refreshToken");
  });

  // Test 5: Internal Server Error handling
  it("should return 401/500 if an unexpected error occurs during verification", async () => {
    jest
      .spyOn(prisma.user, "findUnique")
      .mockRejectedValueOnce(new Error("Database drop error"));

    const user = await prisma.user.create({
      data: {
        username: "errortest",
        email: "error@example.com",
        passwordHash: "hashedpassword123",
      },
    });

    const validRefreshToken = generateRefreshToken(user.id);

    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
    });

    req.cookies.set("refreshToken", validRefreshToken);

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Invalid or expired refresh token");

    jest.restoreAllMocks();
  });
});