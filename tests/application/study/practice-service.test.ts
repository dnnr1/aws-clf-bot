import { describe, expect, it, vi } from "vitest";
import { PracticeService } from "../../../src/application/study/practice-service.js";
import type { PracticeRepository } from "../../../src/application/study/practice-repository.js";

function createRepository(): PracticeRepository {
  return {
    startSessionWithAnswer: vi.fn(),
    getRandomQuestion: vi.fn(),
    restartSession: vi.fn(),
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

  it("restarts the owned practice session through the repository", async () => {
    const repository = createRepository();
    const service = new PracticeService(repository);

    await service.restart(
      "12345678901234567",
      "86b19e28-4c80-4fc6-9aa4-bddf4b574919",
    );

    expect(repository.restartSession).toHaveBeenCalledWith(
      "12345678901234567",
      "86b19e28-4c80-4fc6-9aa4-bddf4b574919",
    );
  });

  it("answers the practice-channel question while starting a private session", async () => {
    const repository = createRepository();
    const service = new PracticeService(repository);
    const discordUserId = "12345678901234567";
    const questionId = "86b19e28-4c80-4fc6-9aa4-bddf4b574919";

    await service.answerChannelQuestion(discordUserId, questionId, "C");

    expect(repository.startSessionWithAnswer).toHaveBeenCalledWith(
      discordUserId,
      questionId,
      "C",
    );
  });

  it("rejects an invalid option before creating a channel practice session", async () => {
    const repository = createRepository();
    const service = new PracticeService(repository);

    await expect(
      service.answerChannelQuestion(
        "12345678901234567",
        "86b19e28-4c80-4fc6-9aa4-bddf4b574919",
        "X",
      ),
    ).rejects.toMatchObject({ code: "invalid_option" });
    expect(repository.startSessionWithAnswer).not.toHaveBeenCalled();
  });

  it("loads a random question for the automatic practice panel", async () => {
    const repository = createRepository();
    const service = new PracticeService(repository);

    await service.getRandomQuestion();

    expect(repository.getRandomQuestion).toHaveBeenCalledOnce();
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
