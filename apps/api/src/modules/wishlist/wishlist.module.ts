import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { StarsModule } from "../stars/stars.module.js";
import { SeeTgGiftsService } from "./see-tg-gifts.service.js";
import { WishlistController } from "./wishlist.controller.js";
import { WishlistService } from "./wishlist.service.js";

@Module({
  imports: [JwtModule.register({}), StarsModule],
  controllers: [WishlistController],
  providers: [WishlistService, SeeTgGiftsService],
  exports: [WishlistService]
})
export class WishlistModule {}
