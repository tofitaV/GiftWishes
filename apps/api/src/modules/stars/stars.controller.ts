import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { normalizeLanguage } from "@gift-wishes/shared";
import { CurrentUser, RequestUser } from "../../common/current-user.js";
import { JwtAuthGuard } from "../../common/jwt-auth.guard.js";
import { StarsService } from "./stars.service.js";

class CreateWishlistSlotInvoiceDto {
  @IsOptional()
  @IsString()
  language?: string;
}

@Controller("stars")
export class StarsController {
  constructor(private readonly stars: StarsService) {}

  @UseGuards(JwtAuthGuard)
  @Post("wishlist-slot/invoice")
  createWishlistSlotInvoice(@CurrentUser() user: RequestUser, @Body() body: CreateWishlistSlotInvoiceDto) {
    return this.stars.createWishlistSlotInvoice(user.id, normalizeLanguage(body.language));
  }
}

