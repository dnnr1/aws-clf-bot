import { describe, expect, it } from "vitest";
import { getDueDailyTipSlot } from "../../../src/infrastructure/discord/daily-tip-scheduler.js";

describe("getDueDailyTipSlot", () => {
  it.each([
    ["2026-11-21T12:00:00.000Z", 1],
    ["2026-11-21T16:59:00.000Z", 2],
    ["2026-11-21T20:30:00.000Z", 3],
  ])("returns the scheduled UTC slot for %s", (timestamp, expectedSlot) => {
    expect(getDueDailyTipSlot(new Date(timestamp))).toBe(expectedSlot);
  });

  it("does not backfill a missed publication slot", () => {
    expect(getDueDailyTipSlot(new Date("2026-11-21T13:00:00.000Z"))).toBeNull();
  });
});
