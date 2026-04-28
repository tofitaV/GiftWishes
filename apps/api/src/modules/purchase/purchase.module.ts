import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { GiftSatelliteModule } from "../gift-satellite/gift-satellite.module.js";
import { StarsModule } from "../stars/stars.module.js";
import { PurchaseController } from "./purchase.controller.js";
import { PurchaseService } from "./purchase.service.js";

@Module({
  imports: [JwtModule.register({}), GiftSatelliteModule, StarsModule],
  controllers: [PurchaseController],
  providers: [PurchaseService],
  exports: [PurchaseService]
})
export class PurchaseModule {}

