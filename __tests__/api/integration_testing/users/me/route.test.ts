import { GET } from "@/app/api/users/me/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

describe("API /api/users/me Integration Tests", () => {
  let testUserId: string;
  let validToken: string;

  beforeEach(async () => {
    // Seed primary test user
    const user = await prisma.user.create({
      data: {
        username: "behramprofile",
        email: "behramprofile@gmail.com",
        passwordHash: "hashedpass123",
        role: "STUDENT",
      },
    });
    testUserId = user.id;

    // Sign valid JWT
    validToken = jwt.sign(
      { userId: testUserId },
      process.env.JWT_ACCESS_SECRET || "your-secret-key"
    );
  });

  // ==========================================
  // Auth Error Tests
  // ==========================================
  it("should return 401 if access token cookie is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/users/me", {
      method: "GET",
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized: Missing access token");
  });

  it("should return 401 if access token is invalid or expired", async () => {
    const req = new NextRequest("http://localhost:3000/api/users/me", {
      method: "GET",
    });
    req.cookies.set("accessToken", "invalid.jwt.token");

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized: Invalid or expired token");
  });

  // ==========================================
  // Database Lookup & Profile Retrieval
  // ==========================================
  it("should return 404 if token belongs to a user that no longer exists", async () => {
    const nonExistentUserId = "00000000-0000-0000-0000-000000000000";
    const orphanedToken = jwt.sign(
      { userId: nonExistentUserId },
      process.env.JWT_ACCESS_SECRET || "your-secret-key"
    );

    const req = new NextRequest("http://localhost:3000/api/users/me", {
      method: "GET",
    });
    req.cookies.set("accessToken", orphanedToken);

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("User profile not found");
  });

  it("should return 200 and sanitized user profile when authenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/users/me", {
      method: "GET",
    });
    req.cookies.set("accessToken", validToken);

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe(testUserId);
    expect(data.user.username).toBe("behramprofile");
    expect(data.user.email).toBe("behramprofile@gmail.com");
    expect(data.user.role).toBe("STUDENT");
    expect(data.user.createdAt).toBeDefined();
    expect(data.user).not.toHaveProperty("passwordHash");
  });
});