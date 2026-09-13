import { GET } from "@/app/api/users/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

describe("API /api/admin/users Integration Tests", () => {
  let adminUserId: string;
  let regularUserId: string;
  let adminToken: string;
  let regularUserToken: string;

  beforeEach(async () => {
    // 1. Seed Admin User
    const adminUser = await prisma.user.create({
      data: {
        username: "behramadmin",
        email: "behramadmin@gmail.com",
        passwordHash: "hashedpass123",
        role: "ADMIN",
      },
    });
    adminUserId = adminUser.id;

    // 2. Seed Regular User
    const regularUser = await prisma.user.create({
      data: {
        username: "regularstudent",
        email: "regularstudent@gmail.com",
        passwordHash: "hashedpass123",
        role: "STUDENT",
      },
    });
    regularUserId = regularUser.id;

    // 3. Sign JWT Tokens
    const secret = process.env.JWT_ACCESS_SECRET || "your-secret-key";

    adminToken = jwt.sign(
      { userId: adminUserId, role: "ADMIN" },
      secret
    );

    regularUserToken = jwt.sign(
      { userId: regularUserId, role: "USER" },
      secret
    );
  });

  // ==========================================
  // Authentication & Authorization Guards
  // ==========================================
  it("should return 401 if access token cookie is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "GET",
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized access: Missing token");
  });

  it("should return 401 if token is invalid or malformed", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "GET",
    });
    req.cookies.set("accessToken", "invalid-token-string");

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized access: Invalid or expired token");
  });

  it("should return 403 Forbidden if user role is not ADMIN", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "GET",
    });
    req.cookies.set("accessToken", regularUserToken);

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Forbidden: Admin access required");
  });

  // ==========================================
  // Success Flow & Data Retrieval
  // ==========================================
  it("should return 200 and all users sorted by createdAt desc for ADMIN role", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "GET",
    });
    req.cookies.set("accessToken", adminToken);

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.users).toBeDefined();
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users.length).toBeGreaterThanOrEqual(2);

    // Verify user objects omit sensitive password fields
    const firstUser = data.users[0];
    expect(firstUser).toHaveProperty("id");
    expect(firstUser).toHaveProperty("username");
    expect(firstUser).toHaveProperty("email");
    expect(firstUser).toHaveProperty("role");
    expect(firstUser).toHaveProperty("createdAt");
    expect(firstUser).not.toHaveProperty("passwordHash");

    // Verify correct order (descending by createdAt)
    const dates = data.users.map((u: { createdAt: string }) =>
      new Date(u.createdAt).getTime()
    );
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
    }
  });
});