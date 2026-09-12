import { NextRequest } from "next/server";
import { GET } from "@/app/api/users/me/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

jest.mock("jsonwebtoken");

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe("GET /api/users/me Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Missing Token
  it("should return 401 if accessToken cookie is missing", async () => {
    const req = new NextRequest("http://localhost/api/users/me", {
      method: "GET",
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized: Missing access token");
  });

  // 2. Invalid or Expired Token
  it("should return 401 if JWT token verification fails", async () => {
    jest.mocked(jwt.verify).mockImplementation(() => {
      throw new Error("Token expired");
    });

    const req = new NextRequest("http://localhost/api/users/me", {
      method: "GET",
      headers: { cookie: "accessToken=invalid_token" },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized: Invalid or expired token");
  });

  // 3. User Not Found in Database
  it("should return 404 if user is not found in database", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-999" } as never);
    jest.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/users/me", {
      method: "GET",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("User profile not found");
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-999" },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  });

  // 4. Successful Profile Retrieval
  it("should return 200 with user profile when token and user are valid", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    const mockUser = {
      id: "user-101",
      username: "behram",
      email: "behram@example.com",
      role: "USER",
      createdAt: new Date().toISOString(),
    };

    jest.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const req = new NextRequest("http://localhost/api/users/me", {
      method: "GET",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.user).toEqual(mockUser);
  });

  // 5. Database Failure Handling
  it("should catch database exceptions and return 401 per error block handler", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
    jest
      .mocked(prisma.user.findUnique)
      .mockRejectedValue(new Error("Database offline"));

    const req = new NextRequest("http://localhost/api/users/me", {
      method: "GET",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized: Invalid or expired token");
  });
});