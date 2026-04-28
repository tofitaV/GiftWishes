import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";
import { CurrentUser, RequestUser } from "../../common/current-user.js";
import { JwtAuthGuard } from "../../common/jwt-auth.guard.js";
import { WalletService } from "./wallet.service.js";

class ConnectWalletDto {
  @IsString()
  @IsNotEmpty()
  address!: string;
}

class ConfirmDepositDto {
  @IsString()
  @IsNotEmpty()
  txHash!: string;

  @IsString()
  @IsNotEmpty()
  amountNano!: string;
}

class WithdrawDto {
  @IsString()
  @IsNotEmpty()
  amountNano!: string;
}

@Controller("wallet")
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @UseGuards(JwtAuthGuard)
  @Post("connect")
  connect(@CurrentUser() user: RequestUser, @Body() body: ConnectWalletDto) {
    return this.wallet.connect(user.id, body.address);
  }

  @UseGuards(JwtAuthGuard)
  @Post("deposit/confirm")
  confirmDeposit(@CurrentUser() user: RequestUser, @Body() body: ConfirmDepositDto) {
    return this.wallet.confirmDeposit(user.id, body.txHash, BigInt(body.amountNano));
  }

  @UseGuards(JwtAuthGuard)
  @Post("withdraw")
  withdraw(@CurrentUser() user: RequestUser, @Body() body: WithdrawDto) {
    return this.wallet.withdraw(user.id, BigInt(body.amountNano));
  }
}

