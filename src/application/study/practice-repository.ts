import type {
  AnswerFeedback,
  AnswerOptionKey,
  StudyQuestion,
} from "../../domain/study/question.js";

export interface StartedPracticeSession {
  sessionId: string;
  question: StudyQuestion;
}

export interface PresentedQuestion {
  question: StudyQuestion;
  mode: "practice" | "exam_simulation";
  position: number;
  totalQuestions: number | null;
  expiresAt: Date | null;
}

export interface StartedExamSession extends PresentedQuestion {
  sessionId: string;
  mode: "exam_simulation";
  totalQuestions: number;
  questionCount: number;
  expiresAt: Date;
}

export interface PracticeRepository {
  startSession(discordUserId: string): Promise<StartedPracticeSession>;
  startExam(discordUserId: string): Promise<StartedExamSession>;
  getNextQuestion(
    discordUserId: string,
    sessionId: string,
  ): Promise<PresentedQuestion | null>;
  submitAnswer(
    discordUserId: string,
    sessionId: string,
    questionId: string,
    optionKey: AnswerOptionKey,
  ): Promise<AnswerFeedback>;
}
