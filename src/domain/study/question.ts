export const answerOptionKeys = ["A", "B", "C", "D"] as const;

export type AnswerOptionKey = (typeof answerOptionKeys)[number];

export interface LocalizedText {
  en: string;
  "pt-BR": string;
}

export interface StudyQuestionOption {
  key: AnswerOptionKey;
  text: LocalizedText;
}

export interface StudyQuestion {
  id: string;
  domainId: string;
  prompt: LocalizedText;
  options: StudyQuestionOption[];
  services: string[];
}

export interface ExamDomainResult {
  domainId: string;
  domainName: LocalizedText;
  correctCount: number;
  questionCount: number;
}

export interface CompletedExamResult {
  correctCount: number;
  questionCount: number;
  accuracyPercentage: number;
  durationSeconds: number;
  domainResults: ExamDomainResult[];
}

export interface AnswerFeedback {
  mode: "practice" | "exam_simulation";
  isCorrect: boolean;
  correctOptionKey: AnswerOptionKey;
  correctOptionText: LocalizedText;
  explanation: LocalizedText;
  correctCount: number;
  incorrectCount: number;
  services: string[];
  examResult?: CompletedExamResult;
}

export function isAnswerOptionKey(value: unknown): value is AnswerOptionKey {
  return value === "A" || value === "B" || value === "C" || value === "D";
}
