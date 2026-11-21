import { isAnswerOptionKey } from "../../domain/study/question.js";
import type { AnswerFeedback } from "../../domain/study/question.js";
import { PracticeError } from "./practice-error.js";
import type {
  PracticeRepository,
  PresentedQuestion,
  StartedExamSession,
  StartedPracticeSession,
} from "./practice-repository.js";

export class PracticeService {
  constructor(private readonly repository: PracticeRepository) {}

  start(discordUserId: string): Promise<StartedPracticeSession> {
    return this.repository.startSession(discordUserId);
  }

  startExam(discordUserId: string): Promise<StartedExamSession> {
    return this.repository.startExam(discordUserId);
  }

  next(
    discordUserId: string,
    sessionId: string,
  ): Promise<PresentedQuestion | null> {
    return this.repository.getNextQuestion(discordUserId, sessionId);
  }

  async answer(
    discordUserId: string,
    sessionId: string,
    questionId: string,
    optionKey: unknown,
  ): Promise<AnswerFeedback> {
    if (!isAnswerOptionKey(optionKey)) {
      throw new PracticeError("invalid_option");
    }

    return this.repository.submitAnswer(
      discordUserId,
      sessionId,
      questionId,
      optionKey,
    );
  }
}
