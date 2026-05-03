import { Injectable } from "@nestjs/common";

@Injectable()
export class TelegramAuthDataStore {
  private readonly initDataByUserId = new Map<string, string>();

  set(userId: string, initData: string) {
    this.initDataByUserId.set(userId, initData);
  }

  get(userId: string) {
    return this.initDataByUserId.get(userId) ?? null;
  }
}
