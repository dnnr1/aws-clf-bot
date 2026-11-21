import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseDailyTipBank } from "../../../src/infrastructure/questions/daily-tip-schema.js";

const tipBankUrl = new URL("../../../data/tips/clf-c02.json", import.meta.url);

describe("parseDailyTipBank", () => {
  it("accepts the bilingual sourced tip bank", async () => {
    const tipBank = parseDailyTipBank(
      JSON.parse(await readFile(tipBankUrl, "utf8")),
    );

    expect(tipBank.length).toBeGreaterThanOrEqual(3);
    expect(tipBank[0]?.content["pt-BR"]).toBeTruthy();
  });

  it("rejects duplicate tip identifiers", async () => {
    const contents = JSON.parse(await readFile(tipBankUrl, "utf8"));
    contents[1].id = contents[0].id;

    expect(() => parseDailyTipBank(contents)).toThrow(
      "Tip identifiers must be unique within the bank.",
    );
  });
});
