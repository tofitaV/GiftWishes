import { Body, Controller, Post } from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";
import { AuthService } from "./auth.service.js";

class TelegramLoginDto {
  @IsString()
  @IsNotEmpty()
  initData!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("telegram")
  login(@Body() body: TelegramLoginDto) {
    return this.authService.loginWithTelegramInitData(body.initData);
  }
}

