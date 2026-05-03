import { Body, Controller, Delete, Get, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { CurrentUser, RequestUser } from "../../common/current-user.js";
import { JwtAuthGuard } from "../../common/jwt-auth.guard.js";
import { WishlistService } from "./wishlist.service.js";

class CreateWishlistItemDto {
  @IsString()
  collectionName!: string;

  @IsString()
  modelName!: string;

  @IsOptional()
  @IsString()
  backdropName?: string;

  @IsOptional()
  @IsString()
  symbolName?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;
}

@Controller("wishlist")
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @UseGuards(JwtAuthGuard)
  @Get("mine")
  mine(@CurrentUser() user: RequestUser) {
    return this.wishlist.getMine(user.id);
  }

  @Get("public/:userId")
  publicList(@Param("userId") userId: string) {
    return this.wishlist.getPublic(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() body: CreateWishlistItemDto, @Headers("x-telegram-init-data") telegramAuthData?: string) {
    return this.wishlist.create(user.id, { ...body, telegramAuthData });
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.wishlist.remove(user.id, id);
  }
}
