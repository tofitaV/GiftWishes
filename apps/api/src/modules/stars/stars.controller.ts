import { Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/current-user.js";
import { JwtAuthGuard } from "../../common/jwt-auth.guard.js";
import { StarsService } from "./stars.service.js";

@Controller("stars")
export class StarsController {
  constructor(private readonly stars: StarsService) {}

  @UseGuards(JwtAuthGuard)
  @Post("wishlist-slot/stub")
  buyWishlistSlot(@CurrentUser() user: RequestUser) {
    return this.stars.stubBuyWishlistSlot(user.id);
  }
}

