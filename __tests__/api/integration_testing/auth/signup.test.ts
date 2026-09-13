import { POST } from "@/app/api/auth/signup/route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

describe("POST /api/auth/signup Integration Tests", () => {
  // Test 1: Successful User Registration
  it("should successfully register a new user and persist record in PostgreSQL (201)", async () => {
    const signupData = {
      username: "johndoe",
      email: "johndoe@example.com",
      password: "Password123!",
    };

    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupData),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.message).toBe("User registered successfully");
    expect(body.user).toMatchObject({
      username: signupData.username,
      email: signupData.email,
    });
    expect(body.user.id).toBeDefined();

    // Verify raw DB record persistence & password hashing
    const dbUser = await prisma.user.findUnique({
      where: { email: signupData.email },
    });

    expect(dbUser).not.toBeNull();
    expect(dbUser?.username).toBe(signupData.username);
    expect(dbUser?.passwordHash).not.toBe(signupData.password);
  });

  // Test 2: Invalid Email Validation
  it("should return 400 if the email format is invalid", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "johndoe",
        email: "invalid-email-format",
        password: "Password123!",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid email address");
  });

  // Test 3: Short Username Validation
  it("should return 400 if username is under minimum length", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "ab",
        email: "valid@example.com",
        password: "Password123!",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Username must be at least 3 characters");
  });

  // Test 4: Duplicate Email Conflict (409)
  it("should return 409 if user already exists with this email", async () => {
    const hashedPassword = await bcrypt.hash("Password123!", 10);
    await prisma.user.create({
      data: {
        username: "existinguser",
        email: "duplicate@example.com",
        passwordHash: hashedPassword,
      },
    });

    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "newuser",
        email: "duplicate@example.com",
        password: "Password123!",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("User already exists with this email");
  });

  // Test 5: Empty Request Body Payload
  it("should return 400 if request body is empty", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  // Test 6: Internal Error Handling (500)
  it("should return 500 when an unhandled database error occurs", async () => {
    jest
      .spyOn(prisma.user, "findUnique")
      .mockRejectedValueOnce(new Error("Database offline"));

    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "johndoe",
        email: "johndoe@example.com",
        password: "Password123!",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");

    jest.restoreAllMocks();
  });
});