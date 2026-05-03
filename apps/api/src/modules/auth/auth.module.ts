import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { TelegramAuthDataStore } from "./telegram-auth-data.store.js";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TelegramAuthDataStore],
  exports: [AuthService, TelegramAuthDataStore]
})
export class AuthModule {}
