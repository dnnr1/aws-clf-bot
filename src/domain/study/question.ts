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
}

export interface AnswerFeedback {
  isCorrect: boolean;
  correctOptionKey: AnswerOptionKey;
  correctOptionText: LocalizedText;
  explanation: LocalizedText;
}

export function isAnswerOptionKey(value: unknown): value is AnswerOptionKey {
  return value === "A" || value === "B" || value === "C" || value === "D";
}
