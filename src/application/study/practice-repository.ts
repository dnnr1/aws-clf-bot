import type {
  AnswerFeedback,
  AnswerOptionKey,
  StudyQuestion,
} from "../../domain/study/question.js";

export interface StartedPracticeSession {
  sessionId: string;
  presentationId: string;
  question: StudyQuestion;
  correctCount: number;
  incorrectCount: number;
}

export interface PresentedQuestion {
  presentationId: string;
  question: StudyQuestion;
  mode: "practice" | "exam_simulation";
  position: number;
  totalQuestions: number | null;
  expiresAt: Date | null;
  correctCount: number;
  incorrectCount: number;
}

export interface StartedExamSession extends PresentedQuestion {
  sessionId: string;
  mode: "exam_simulation";
  totalQuestions: number;
  questionCount: number;
  expiresAt: Date;
}

export interface StartedPracticeAnswer {
  sessionId: string;
  feedback: AnswerFeedback;
}

export interface PracticeRepository {
  startSessionWithAnswer(
    discordUserId: string,
    questionId: string,
    optionKey: AnswerOptionKey,
  ): Promise<StartedPracticeAnswer>;
  getRandomQuestion(): Promise<StudyQuestion>;
  restartSession(
    discordUserId: string,
    sessionId: string,
  ): Promise<StartedPracticeSession>;
  startExam(discordUserId: string): Promise<StartedExamSession>;
  getNextQuestion(
    discordUserId: string,
    sessionId: string,
  ): Promise<PresentedQuestion | null>;
  submitAnswer(
    discordUserId: string,
    sessionId: string,
    presentationId: string,
    optionKey: AnswerOptionKey,
  ): Promise<AnswerFeedback>;
}
