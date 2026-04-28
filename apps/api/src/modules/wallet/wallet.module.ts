import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { WalletController } from "./wallet.controller.js";
import { WalletService } from "./wallet.service.js";

@Module({
  imports: [JwtModule.register({})],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService]
})
export class WalletModule {}

