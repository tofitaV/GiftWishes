import { describe, expect, it } from "vitest";
import { SLOT_PURCHASE_DISABLED } from "./slot-purchase";

describe("slot purchase controls", () => {
  it("keeps slot purchases disabled while the feature is paused", () => {
    expect(SLOT_PURCHASE_DISABLED).toBe(true);
  });
});
