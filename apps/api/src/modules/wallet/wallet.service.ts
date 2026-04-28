import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  connect(userId: string, address: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { connectedWalletAddress: address }
    });
  }

  async confirmDeposit(userId: string, txHash: string, amountNano: bigint) {
    if (amountNano <= 0n) throw new BadRequestException("Deposit amount must be positive");

    return this.prisma.$transaction(async (tx) => {
      const deposit = await tx.walletLedgerEntry.create({
        data: { userId, type: "deposit", amountNano, status: "confirmed", txHash }
      });
      await tx.user.update({
        where: { id: userId },
        data: { tonBalanceNano: { increment: amountNano } }
      });
      await tx.walletLedgerEntry.create({
        data: {
          userId,
          type: "split_transfer",
          amountNano: amountNano / 2n,
          status: "pending",
          metadata: { reason: "50/50 Gift Satellite service wallet split", sourceDepositId: deposit.id }
        }
      });
      return deposit;
    });
  }

  async withdraw(userId: string, amountNano: bigint) {
    if (amountNano <= 0n) throw new BadRequestException("Withdrawal amount must be positive");

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (!user.connectedWalletAddress) throw new BadRequestException("Connect TON wallet first");
      if (user.tonBalanceNano < amountNano) throw new BadRequestException("Insufficient balance");

      await tx.user.update({ where: { id: userId }, data: { tonBalanceNano: { decrement: amountNano } } });
      return tx.walletLedgerEntry.create({
        data: {
          userId,
          type: "withdrawal",
          amountNano,
          status: "pending",
          metadata: { to: user.connectedWalletAddress }
        }
      });
    });
  }
}

