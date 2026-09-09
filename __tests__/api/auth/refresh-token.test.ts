import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/refresh-token/route";
import { prisma } from "@/lib/prisma";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "@/lib/auth/token";
import { Role } from "@prisma/client";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth/token", () => ({
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
}));

describe("POST /api/auth/refresh Unit Tests", () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Missing Refresh Token Cookie
  it("should return 401 if refresh token cookie is missing", async () => {
    const req = new NextRequest("http://localhost/api/auth/refresh", {
      method: "POST",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Refresh token missing");
  });

  // 2. Invalid or Expired Refresh Token (Verification Fails)
  it("should return 401 if refresh token verification throws an error", async () => {
    jest.mocked(verifyRefreshToken).mockImplementation(() => {
      throw new Error("Token expired");
    });

    const req = new NextRequest("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: {
        cookie: "refreshToken=invalid_or_expired_token",
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Invalid or expired refresh token");
  });

  // 3. User Not Found in Database
  it("should return 401 if user no longer exists in database", async () => {
    jest.mocked(verifyRefreshToken).mockReturnValue({ userId: "user-101" } as never);
    jest.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: {
        cookie: "refreshToken=valid_token",
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("User no longer exists");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-101" },
      select: { id: true, email: true, role: true },
    });
  });

  // 4. Successful Token Refresh (200 + Cookies Set)
  it("should return 200 and set new accessToken and refreshToken cookies on success", async () => {
    const mockUser = {
      id: "user-101",
      email: "behram@gmail.com",
      role: Role.STUDENT,
    };

    jest.mocked(verifyRefreshToken).mockReturnValue({ userId: "user-101" } as never);
    jest.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    jest.mocked(generateAccessToken).mockReturnValue("new_access_token");
    jest.mocked(generateRefreshToken).mockReturnValue("new_refresh_token");

    const req = new NextRequest("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: {
        cookie: "refreshToken=valid_old_token",
      },
    });

    const res = await POST(req);
    const data = await res.json();

    // Verify response
    expect(res.status).toBe(200);
    expect(data.message).toBe("Token refreshed successfully");

    // Verify token generation calls
    expect(generateAccessToken).toHaveBeenCalledWith({
      userId: "user-101",
      email: "behram@gmail.com",
      role: Role.STUDENT,
    });
    expect(generateRefreshToken).toHaveBeenCalledWith("user-101");

    // Verify cookies set on response
    const accessCookie = res.cookies.get("accessToken");
    const refreshCookie = res.cookies.get("refreshToken");

    expect(accessCookie?.value).toBe("new_access_token");
    expect(refreshCookie?.value).toBe("new_refresh_token");
  });

  // 5. Database Failure Exception
  it("should return 401 if database operation throws an exception", async () => {
    jest.mocked(verifyRefreshToken).mockReturnValue({ userId: "user-101" } as never);
    jest.mocked(prisma.user.findUnique).mockRejectedValue(new Error("DB Down"));

    const req = new NextRequest("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: {
        cookie: "refreshToken=valid_token",
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Invalid or expired refresh token");
  });
});