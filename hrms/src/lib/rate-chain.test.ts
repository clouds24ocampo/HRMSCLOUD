import { describe, expect, it } from "vitest";
import { formatMoney, formatRate, groupPesos, parsePesos, payForMinutes } from "./money";
import { rates } from "./ph/calc";

describe("₱25,000 a month, as HR checks it by hand", () => {
  const r = rates("MONTHLY", 2_500_000, 313, 8);
  it("× 12 = 300,000.00; ÷ 313 = 958.4664 a day; ÷ 8 = 119.8083 an hour; ½ month = 12,500.00 a cut-off", () => {
    expect(formatMoney(r.monthly * 12)).toBe("₱300,000.00");
    expect(formatRate(r.daily)).toBe("₱958.4664");
    expect(formatRate(r.hourly)).toBe("₱119.8083");
    expect(formatMoney(Math.round(r.monthly / 2))).toBe("₱12,500.00");
  });
  it("a full 8-hour day pays ₱958.47, 7 hours ₱838.66", () => {
    expect(formatMoney(payForMinutes(2_500_000, 480, 313, 8))).toBe("₱958.47");
    expect(formatMoney(payForMinutes(2_500_000, 420, 313, 8))).toBe("₱838.66");
  });
});

describe("peso fields show separators as you type", () => {
  it("groups thousands and finishes with centavos; the server reads it back", () => {
    expect(groupPesos("25000")).toBe("25,000");
    expect(groupPesos("1234567.5")).toBe("1,234,567.5");
    expect(groupPesos("25000", true)).toBe("25,000.00");
    expect(groupPesos("₱ 10,000.999", true)).toBe("10,000.99");
    expect(groupPesos("")).toBe("");
    expect(parsePesos(groupPesos("25000", true))).toBe(2_500_000);
  });
});
