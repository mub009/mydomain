import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/modules/auth/auth.validation";

describe("registerSchema", () => {
  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "SuperSecret123",
      firstName: "Jane",
      lastName: "Doe",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "short",
      firstName: "Jane",
      lastName: "Doe",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: "SuperSecret123",
      firstName: "Jane",
      lastName: "Doe",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires both email and password", () => {
    expect(loginSchema.safeParse({ email: "user@example.com" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "user@example.com", password: "x" }).success).toBe(true);
  });
});
