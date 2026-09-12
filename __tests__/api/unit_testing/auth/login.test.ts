import { POST } from "@/app/api/auth/login/route";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/token";
import { Role } from "@prisma/client";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
}));

jest.mock("@/lib/auth/token", () => ({
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
}));

describe("POST /api/auth/login Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Invalid email format
  it("should return 400 if the email is invalid", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "behramgmail.com", password: "behram123" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toHaveProperty("error");
    expect(data.error).toBe("Invalid email address");
  });

  // Test 2: Short password length
  it("should return 400 if the password length is short", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "behram@gmail.com", password: "b" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toHaveProperty("error");
    expect(data.error).toBe("Password min length is 5 char");
  });

  // Test 3: Empty body payload
  it("should return 400 if request body is empty", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toHaveProperty("error");
  });

  // Test 4: User not found in database
  it("should return 401 if user is not found", async () => {
    jest.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "sam@gmail.com", password: "sam123" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toHaveProperty("error");
    expect(data.error).toBe("Invalid email or password");
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  // Test 5: Incorrect password comparison
  it("should return 401 if the password is invalid", async () => {
    jest.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-123",
      username: "john_doe",
      email: "test@example.com",
      role: Role.STUDENT,
      passwordHash: "hashed_password",
      createdAt: new Date(),
    });

    jest.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "behram@gmail.com", password: "behram1234" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toHaveProperty("error");
    expect(data.error).toBe("Invalid email or password");
  });

  // Test 6: Successful login
  it("should return 200 and set auth cookies when credentials are valid", async () => {
    jest.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-123",
      username: "behram khan",
      email: "behram@gmail.com",
      role: Role.ADMIN,
      passwordHash: "hashed_password",
      createdAt: new Date(),
    });

    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
    jest.mocked(generateAccessToken).mockReturnValue("mock-access-token");
    jest.mocked(generateRefreshToken).mockReturnValue("mock-refresh-token");

    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "behram@gmail.com", password: "behram123" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);

    const accessCookie = res.cookies.get("accessToken");
    expect(accessCookie).toBeDefined();
    expect(accessCookie?.value).toBe("mock-access-token");

    expect(data.message).toBe("Login successful");
    expect(data.user).toHaveProperty("id");
    expect(data.user).toHaveProperty("username");
    expect(data.user).toHaveProperty("email");
    expect(data.user).toHaveProperty("role");
  });

  // Test 7: Internal Server Error on DB failure
  it("should return 500 if database query throws an error", async () => {
    jest.mocked(prisma.user.findUnique).mockRejectedValue(new Error("DB Down"));

    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "behram@gmail.com", password: "behram123" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});