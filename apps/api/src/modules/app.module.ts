import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module.js";
import { BotModule } from "./bot/bot.module.js";
import { GiftSatelliteModule } from "./gift-satellite/gift-satellite.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { PurchaseModule } from "./purchase/purchase.module.js";
import { StarsModule } from "./stars/stars.module.js";
import { WalletModule } from "./wallet/wallet.module.js";
import { WishlistModule } from "./wishlist/wishlist.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    GiftSatelliteModule,
    StarsModule,
    WalletModule,
    WishlistModule,
    PurchaseModule,
    BotModule
  ]
})
export class AppModule {}

