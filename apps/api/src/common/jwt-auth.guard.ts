import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { RequestUser } from "./current-user.js";

type JwtPayload = {
  sub?: unknown;
  telegramId?: unknown;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: RequestUser }>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    if (!token) throw new UnauthorizedException();

    const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret: this.config.getOrThrow<string>("JWT_SECRET") });
    if (typeof payload.sub !== "string" || typeof payload.telegramId !== "string") {
      throw new UnauthorizedException();
    }

    request.user = { id: payload.sub, telegramId: payload.telegramId };
    return true;
  }
}
