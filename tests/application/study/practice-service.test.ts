import { describe, expect, it, vi } from "vitest";
import { PracticeService } from "../../../src/application/study/practice-service.js";
import type { PracticeRepository } from "../../../src/application/study/practice-repository.js";

function createRepository(): PracticeRepository {
  return {
    startSession: vi.fn(),
    startExam: vi.fn(),
    getNextQuestion: vi.fn(),
    submitAnswer: vi.fn(),
  };
}

describe("PracticeService", () => {
  it("rejects answer identifiers outside the four supported options", async () => {
    const repository = createRepository();
    const service = new PracticeService(repository);

    await expect(
      service.answer(
        "12345678901234567",
        "86b19e28-4c80-4fc6-9aa4-bddf4b574919",
        "86b19e28-4c80-4fc6-9aa4-bddf4b574919",
        "E",
      ),
    ).rejects.toMatchObject({ code: "invalid_option" });
    expect(repository.submitAnswer).not.toHaveBeenCalled();
  });

  it("delegates exam creation to the study repository", async () => {
    const repository = createRepository();
    const service = new PracticeService(repository);

    await service.startExam("12345678901234567");

    expect(repository.startExam).toHaveBeenCalledWith("12345678901234567");
  });

  it("delegates supported answers to the session repository", async () => {
    const repository = createRepository();
    const service = new PracticeService(repository);

    await service.answer(
      "12345678901234567",
      "86b19e28-4c80-4fc6-9aa4-bddf4b574919",
      "86b19e28-4c80-4fc6-9aa4-bddf4b574919",
      "B",
    );

    expect(repository.submitAnswer).toHaveBeenCalledWith(
      "12345678901234567",
      "86b19e28-4c80-4fc6-9aa4-bddf4b574919",
      "86b19e28-4c80-4fc6-9aa4-bddf4b574919",
      "B",
    );
  });
});
