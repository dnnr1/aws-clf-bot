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
  it("contains more than 200 weighted questions across all exam domains", () => {
    const questionsByDomain = new Map<string, number>();
    const familiesByDomain = new Map<string, Set<string>>();
    for (const question of questionBank) {
      questionsByDomain.set(
        question.domainId,
        (questionsByDomain.get(question.domainId) ?? 0) + 1,
      );
      const families = familiesByDomain.get(question.domainId) ?? new Set();
      families.add(question.familyId);
      familiesByDomain.set(question.domainId, families);
    }

    expect(questionBank.length).toBeGreaterThanOrEqual(200);
    expect({
      "cloud-concepts": questionsByDomain.get("cloud-concepts"),
      "security-compliance": questionsByDomain.get("security-compliance"),
      "cloud-technology-services": questionsByDomain.get(
        "cloud-technology-services",
      ),
      "billing-pricing-support": questionsByDomain.get(
        "billing-pricing-support",
      ),
    }).toEqual({
      "cloud-concepts": 51,
      "security-compliance": 64,
      "cloud-technology-services": 72,
      "billing-pricing-support": 24,
    });
    expect({
      "cloud-concepts": familiesByDomain.get("cloud-concepts")?.size,
      "security-compliance": familiesByDomain.get("security-compliance")?.size,
      "cloud-technology-services": familiesByDomain.get(
        "cloud-technology-services",
      )?.size,
      "billing-pricing-support": familiesByDomain.get("billing-pricing-support")
        ?.size,
    }).toEqual({
      "cloud-concepts": 17,
      "security-compliance": 22,
      "cloud-technology-services": 24,
      "billing-pricing-support": 8,
    });
  });

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
