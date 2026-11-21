import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseQuestionBank } from "../../../src/infrastructure/questions/question-bank-schema.js";

const questionBankPath = new URL(
  "../../../data/questions/clf-c02.json",
  import.meta.url,
);
const questionBank = parseQuestionBank(
  JSON.parse(await readFile(questionBankPath, "utf8")),
);

describe("parseQuestionBank", () => {
  it("accepts the original bilingual CLF-C02 question bank", () => {
    const question = questionBank.find(
      (entry) => entry.id === "86b19e28-4c80-4fc6-9aa4-bddf4b574919",
    );

    expect(question).toBeDefined();
    expect(question?.options).toHaveLength(4);
    expect(question?.correctOptionKey).toBe("B");
  });

  it("rejects a question bank with a repeated option identifier", async () => {
    const content = JSON.parse(await readFile(questionBankPath, "utf8"));
    content[0].options[1].key = "A";

    expect(() => parseQuestionBank(content)).toThrow(
      "Each answer option must have a unique identifier.",
    );
  });

  it("rejects a question without a localized explanation", async () => {
    const content = JSON.parse(await readFile(questionBankPath, "utf8"));
    delete content[0].explanation["pt-BR"];

    expect(() => parseQuestionBank(content)).toThrow();
  });
});
