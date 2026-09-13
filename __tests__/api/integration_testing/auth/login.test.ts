import { POST } from "@/app/api/auth/login/route";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

describe("POST /api/auth/login Integration Tests", () => {
  // Test 1: Invalid email format
  it("should return 400 if the email is invalid", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "behramgmail.com",
        password: "password123",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid email address");
  });

  // Test 2: Short password length
  it("should return 400 if the password length is short", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "behram@gmail.com",
        password: "p",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Password min length is 5 char");
  });

  // Test 3: Empty body payload
  it("should return 400 if request body is empty", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toHaveProperty("error");
  });

  // Test 4: User not found in database (relies on clearDatabase wiping test DB)
  it("should return 401 if user is not found", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "notfound@gmail.com",
        password: "notfound123",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Invalid email or password");
  });

  // Test 5: Incorrect password comparison
  it("should return 401 if the password is invalid", async () => {
    const hashedPassword = await bcrypt.hash("correctPassword123", 10);
    await prisma.user.create({
      data: {
        username: "behram",
        email: "behram@gmail.com",
        passwordHash: hashedPassword,
      },
    });

    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "behram@gmail.com",
        password: "wrongPassword123",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Invalid email or password");
  });

  // Test 6: Successful login
  it("should return 200 and set auth cookies when credentials are valid", async () => {
    const hashedPassword = await bcrypt.hash("correctPassword123", 10);
    await prisma.user.create({
      data: {
        username: "behram",
        email: "behram@gmail.com",
        passwordHash: hashedPassword,
      },
    });

    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "behram@gmail.com",
        password: "correctPassword123",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe("Login successful");
    expect(data.user).toMatchObject({
      username: "behram",
      email: "behram@gmail.com",
    });

    // Check header cookies dispatched by Next.js response.cookies.set()
    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).toContain("accessToken");
    expect(setCookieHeader).toContain("refreshToken");
  });

  // Test 7: Internal Server Error handling
  it("should return 500 on internal execution failure", async () => {
    jest
      .spyOn(prisma.user, "findUnique")
      .mockRejectedValueOnce(new Error("DB failure"));

    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "behram@gmail.com",
        password: "password123",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");

    jest.restoreAllMocks();
  });
});