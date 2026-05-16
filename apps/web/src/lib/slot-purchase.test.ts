import { describe, expect, it } from "vitest";
import { SLOT_PURCHASE_DISABLED } from "./slot-purchase";

describe("slot purchase controls", () => {
  it("enables real slot purchases", () => {
    expect(SLOT_PURCHASE_DISABLED).toBe(false);
  });
});
