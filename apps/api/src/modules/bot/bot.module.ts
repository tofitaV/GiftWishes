import { Module } from "@nestjs/common";
import { BotService } from "./bot.service.js";

@Module({
  providers: [BotService],
  exports: [BotService]
})
export class BotModule {}

