import { Controller, Get, Param } from "@nestjs/common";
import { GiftSatelliteService } from "./gift-satellite.service.js";

@Controller("gifts")
export class GiftSatelliteController {
  constructor(private readonly satellite: GiftSatelliteService) {}

  @Get("collections")
  collections() {
    return this.satellite.getCollections(0);
  }

  @Get("collection/:collection")
  collection(@Param("collection") collection: string) {
    return this.satellite.getCollection(collection);
  }
}
