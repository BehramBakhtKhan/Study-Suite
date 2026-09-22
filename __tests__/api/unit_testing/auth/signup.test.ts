import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/signup/route";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

jest.mock("bcryptjs", () => ({
  hash: jest.fn()
}))

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn()
    },
  },
}));

describe("POST /api/auth/signup Unit Tests", () => {

  beforeEach(() => {
    jest.clearAllMocks()
  });


  // Missing / Short Password
  it("should return 400 if password is too short", async () => {
    const req = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username: "behram",
        email: "behram@gmail.com",
        password: "123", // Short password
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toHaveProperty("error");
    expect(data.error).toBe("Password min length is 5 char");
  });

  // Missing Username completely
  it("should return 400 if username field is missing completely", async () => {
    const req = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "behram@gmail.com",
        password: "behram123",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toHaveProperty("error");
    expect(data.error).toBe("Invalid input: expected string, received undefined");
  });

  // Missing Password completely
  it("should return 400 if password field is missing completely", async () => {
    const req = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username: "behram",
        email: "behram@gmail.com",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toHaveProperty("error");
    expect(data.error).toBe("Invalid input: expected string, received undefined");
  });

  // Invalid email format
  it("should return 400 if email format is invalid", async () => {
    const req = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username: "behram",
        email: "invalid-email-format",
        password: "behram123",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toHaveProperty("error");
    expect(data.error).toBe("Invalid email address");
  });

  // Missing email field completely
  it("should return 400 if email field is missing completely", async () => {
    const req = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username: "behram",
        password: "behram123",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toHaveProperty("error");
    expect(data.error).toBe("Invalid input: expected string, received undefined");
  });

  it("should return 409 if user already exits with the email", async () => {

    const user = {
      username: "behram",
      email: "behram@gmail.com",
      id: "101",
      passwordHash: "behram123",
      role: Role.ADMIN,
      createdAt: new Date()
    }
    jest.mocked(prisma.user.findUnique).mockResolvedValue(user);

    const req = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username: "behram",
        email: "behram@gmail.com",
        password: "behram123",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data).toHaveProperty("error");
    expect(data.error).toBe("User already exists with this email");

  })

  it("should return 201 when a user is created", async () => {
    // 1. Ensure no existing user is found
    jest.mocked(prisma.user.findUnique).mockResolvedValue(null);

    // 2. Mock bcrypt hash resolution
    jest.mocked(bcrypt.hash).mockResolvedValue("mocked_hashed_password" as never);

    // 3. Mock prisma.user.create to return the projected user object
    jest.mocked(prisma.user.create).mockResolvedValue({
      id: "user-101",
      username: "behram",
      email: "behram@gmail.com",
      role: Role.STUDENT,
      createdAt: new Date(),
    } as never);

    const req = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username: "behram",
        email: "behram@gmail.com",
        password: "behram123",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.message).toBe("User registered successfully");
    expect(data.user).toHaveProperty("id", "user-101");
    expect(data.user.email).toBe("behram@gmail.com");
  });

  it("should return 500 if user creation returns null", async () => {
    jest.mocked(prisma.user.findUnique).mockResolvedValue(null);
    jest.mocked(bcrypt.hash).mockResolvedValue("mocked_hashed_password" as never);
    jest.mocked(prisma.user.create).mockResolvedValue(null as never);

    const req = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username: "behram",
        email: "behram@gmail.com",
        password: "behram123",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toHaveProperty("message", "Something went wrong");
  });

  it("should return 500 if database query fails", async () => {
    jest.mocked(prisma.user.findUnique).mockRejectedValue(new Error("Database connection lost"));

    const req = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username: "behram",
        email: "behram@gmail.com",
        password: "behram123",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toHaveProperty("error", "Internal server error");
  });

})