import { Module } from "@nestjs/common";
import { WishlistModule } from "../wishlist/wishlist.module.js";
import { BotService } from "./bot.service.js";

@Module({
  imports: [WishlistModule],
  providers: [BotService],
  exports: [BotService]
})
export class BotModule {}
