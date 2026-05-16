import { Body, Controller, Patch, Post, UseGuards } from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";
import { normalizeLanguage } from "@gift-wishes/shared";
import { CurrentUser, RequestUser } from "../../common/current-user.js";
import { JwtAuthGuard } from "../../common/jwt-auth.guard.js";
import { AuthService } from "./auth.service.js";

class TelegramLoginDto {
  @IsString()
  @IsNotEmpty()
  initData!: string;
}

class UpdateLanguageDto {
  @IsString()
  @IsNotEmpty()
  language!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("telegram")
  login(@Body() body: TelegramLoginDto) {
    return this.authService.loginWithTelegramInitData(body.initData);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me/language")
  updateLanguage(@CurrentUser() user: RequestUser, @Body() body: UpdateLanguageDto) {
    return this.authService.updatePreferredLanguage(user.id, normalizeLanguage(body.language));
  }
}

