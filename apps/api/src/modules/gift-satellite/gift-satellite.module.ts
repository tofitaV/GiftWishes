import { Module } from "@nestjs/common";
import { GiftSatelliteService } from "./gift-satellite.service.js";

@Module({
  providers: [GiftSatelliteService],
  exports: [GiftSatelliteService]
})
export class GiftSatelliteModule {}

