import { POST } from "@/app/api/auth/logout/route";

describe("POST /api/auth/logout Integration Tests", () => {
  // Test 1: Successful Logout and Cookie Invalidation
  it("should return 200 and clear authentication cookies", async () => {
    const res = await POST();
    const body = await res.json();

    // 1. Verify HTTP Response
    expect(res.status).toBe(200);
    expect(body.message).toBe("Logged out successfully");

    // 2. Verify Cookie Invalidation Headers
    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).toBeDefined();

    // Assert accessToken is expired/cleared
    expect(setCookieHeader).toContain("accessToken=");
    expect(setCookieHeader).toContain("Max-Age=0");

    // Assert refreshToken is expired/cleared
    expect(setCookieHeader).toContain("refreshToken=");
  });

  // Test 2: Cookie Attributes Check
  it("should output secure cookie parameters (HttpOnly & Path=/)", async () => {
    const res = await POST();
    const setCookieHeader = res.headers.get("set-cookie");

    expect(setCookieHeader).toContain("HttpOnly");
    expect(setCookieHeader).toContain("Path=/");
  });
});