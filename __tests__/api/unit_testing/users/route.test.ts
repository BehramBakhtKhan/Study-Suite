import { NextRequest } from "next/server";
import { GET } from "@/app/api/users/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

jest.mock("jsonwebtoken");

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
    },
  },
}));

describe("GET /api/admin/users Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Missing Token
  it("should return 401 if accessToken cookie is missing", async () => {
    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "GET",
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized access: Missing token");
  });

  // 2. Invalid Token
  it("should return 401 if JWT verification fails", async () => {
    jest.mocked(jwt.verify).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "GET",
      headers: { cookie: "accessToken=invalid_token" },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized access: Invalid or expired token");
  });

  // 3. Non-Admin Role Authorization Guard
  it("should return 403 if authenticated user is not an ADMIN", async () => {
    jest.mocked(jwt.verify).mockReturnValue({
      userId: "user-101",
      role: "USER",
    } as never);

    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "GET",
      headers: { cookie: "accessToken=user_token" },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Forbidden: Admin access required");
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  // 4. Successful Admin Fetch
  it("should return 200 with all users when requested by an ADMIN", async () => {
    jest.mocked(jwt.verify).mockReturnValue({
      userId: "admin-1",
      role: "ADMIN",
    } as never);

    const mockUsers = [
      {
        id: "usr-1",
        username: "behram",
        email: "behram@example.com",
        role: "ADMIN",
        createdAt: new Date().toISOString(),
      },
      {
        id: "usr-2",
        username: "johndoe",
        email: "john@example.com",
        role: "USER",
        createdAt: new Date().toISOString(),
      },
    ];

    jest.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as never);

    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "GET",
      headers: { cookie: "accessToken=admin_token" },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.users).toHaveLength(2);
    expect(data.users[0].username).toBe("behram");
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  });

  // 5. Database Failure
  it("should return 500 if database query throws an error", async () => {
    jest.mocked(jwt.verify).mockReturnValue({
      userId: "admin-1",
      role: "ADMIN",
    } as never);

    jest
      .mocked(prisma.user.findMany)
      .mockRejectedValue(new Error("Database failure"));

    const req = new NextRequest("http://localhost/api/admin/users", {
      method: "GET",
      headers: { cookie: "accessToken=admin_token" },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});