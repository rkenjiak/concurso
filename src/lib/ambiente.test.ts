import { describe, expect, it } from "vitest";

describe("ambiente de testes", () => {
  it("roda em UTC", () => {
    expect(process.env.TZ).toBe("UTC");
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(0);
  });
});
