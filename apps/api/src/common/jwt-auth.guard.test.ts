import { describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { RequestUser } from "./current-user.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

type TestRequest = {
  headers: Record<string, string>;
  user?: RequestUser;
};

function executionContextFor(request: TestRequest) {
  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as ExecutionContext;
}

describe("JwtAuthGuard", () => {
  it("maps JWT sub claim to request.user.id", async () => {
    const request: TestRequest = { headers: { authorization: "Bearer jwt-token" } };
    const guard = new JwtAuthGuard(
      {
        verifyAsync: vi.fn(async () => ({ sub: "user-id", telegramId: "telegram-id" }))
      } as never,
      {
        getOrThrow: vi.fn(() => "secret")
      } as never
    );

    await expect(guard.canActivate(executionContextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: "user-id", telegramId: "telegram-id" });
  });

  it("rejects JWT payloads without a user id", async () => {
    const request: TestRequest = { headers: { authorization: "Bearer jwt-token" } };
    const guard = new JwtAuthGuard(
      {
        verifyAsync: vi.fn(async () => ({ telegramId: "telegram-id" }))
      } as never,
      {
        getOrThrow: vi.fn(() => "secret")
      } as never
    );

    await expect(guard.canActivate(executionContextFor(request))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
