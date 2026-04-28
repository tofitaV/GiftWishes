import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { IsString } from "class-validator";
import { CurrentUser, RequestUser } from "../../common/current-user.js";
import { JwtAuthGuard } from "../../common/jwt-auth.guard.js";
import { PurchaseService } from "./purchase.service.js";

class ConfirmPurchaseDto {
  @IsString()
  listingSlug!: string;
}

@Controller("purchase")
export class PurchaseController {
  constructor(private readonly purchases: PurchaseService) {}

  @UseGuards(JwtAuthGuard)
  @Post("quote/:wishlistItemId")
  quote(@CurrentUser() user: RequestUser, @Param("wishlistItemId") wishlistItemId: string) {
    return this.purchases.quote(user.id, wishlistItemId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("confirm/:wishlistItemId")
  confirm(
    @CurrentUser() user: RequestUser,
    @Param("wishlistItemId") wishlistItemId: string,
    @Body() body: ConfirmPurchaseDto
  ) {
    return this.purchases.confirm(user.id, wishlistItemId, body.listingSlug);
  }
}

