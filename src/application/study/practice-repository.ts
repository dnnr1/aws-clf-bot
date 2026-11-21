import type {
  AnswerFeedback,
  AnswerOptionKey,
  StudyQuestion,
} from "../../domain/study/question.js";

export interface StartedPracticeSession {
  sessionId: string;
  question: StudyQuestion;
}

export interface PracticeRepository {
  startSession(discordUserId: string): Promise<StartedPracticeSession>;
  getNextQuestion(
    discordUserId: string,
    sessionId: string,
  ): Promise<StudyQuestion | null>;
  submitAnswer(
    discordUserId: string,
    sessionId: string,
    questionId: string,
    optionKey: AnswerOptionKey,
  ): Promise<AnswerFeedback>;
}
