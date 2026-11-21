import { isAnswerOptionKey } from "../../domain/study/question.js";
import type {
  AnswerFeedback,
  StudyQuestion,
} from "../../domain/study/question.js";
import { PracticeError } from "./practice-error.js";
import type {
  PracticeRepository,
  PresentedQuestion,
  StartedPracticeAnswer,
  StartedExamSession,
  StartedPracticeSession,
} from "./practice-repository.js";

export class PracticeService {
  constructor(private readonly repository: PracticeRepository) {}

  async answerChannelQuestion(
    discordUserId: string,
    questionId: string,
    optionKey: unknown,
  ): Promise<StartedPracticeAnswer> {
    if (!isAnswerOptionKey(optionKey)) {
      throw new PracticeError("invalid_option");
    }

    return this.repository.startSessionWithAnswer(
      discordUserId,
      questionId,
      optionKey,
    );
  }

  getRandomQuestion(): Promise<StudyQuestion> {
    return this.repository.getRandomQuestion();
  }

  restart(
    discordUserId: string,
    sessionId: string,
  ): Promise<StartedPracticeSession> {
    return this.repository.restartSession(discordUserId, sessionId);
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
    presentationId: string,
    optionKey: unknown,
  ): Promise<AnswerFeedback> {
    if (!isAnswerOptionKey(optionKey)) {
      throw new PracticeError("invalid_option");
    }

    return this.repository.submitAnswer(
      discordUserId,
      sessionId,
      presentationId,
      optionKey,
    );
  }
}
