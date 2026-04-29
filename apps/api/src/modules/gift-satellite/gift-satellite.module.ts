import { Module } from "@nestjs/common";
import { GiftSatelliteController } from "./gift-satellite.controller.js";
import { GiftSatelliteService } from "./gift-satellite.service.js";

@Module({
  controllers: [GiftSatelliteController],
  providers: [GiftSatelliteService],
  exports: [GiftSatelliteService]
})
export class GiftSatelliteModule {}
