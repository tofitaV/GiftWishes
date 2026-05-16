import { Module } from "@nestjs/common";
import { StarsModule } from "../stars/stars.module.js";
import { WishlistModule } from "../wishlist/wishlist.module.js";
import { BotService } from "./bot.service.js";

@Module({
  imports: [WishlistModule, StarsModule],
  providers: [BotService],
  exports: [BotService]
})
export class BotModule {}
