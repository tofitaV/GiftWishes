import { describe, expect, it } from "vitest";
import { buildAllowedOrigins } from "./cors.js";

describe("buildAllowedOrigins", () => {
  it("allows the production Vercel frontend by default", () => {
    expect(buildAllowedOrigins().has("https://gift-wishes-api.vercel.app")).toBe(true);
  });

  it("accepts comma-separated configured frontend origins", () => {
    const allowedOrigins = buildAllowedOrigins("https://first.example.com, https://second.example.com/");

    expect(allowedOrigins.has("https://first.example.com")).toBe(true);
    expect(allowedOrigins.has("https://second.example.com")).toBe(true);
  });
});
