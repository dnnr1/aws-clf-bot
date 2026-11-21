export type PracticeErrorCode =
  | "already_answered"
  | "invalid_option"
  | "no_questions_available"
  | "question_not_in_session"
  | "session_closed"
  | "session_not_found";

export class PracticeError extends Error {
  constructor(readonly code: PracticeErrorCode) {
    super(code);
    this.name = "PracticeError";
  }
}
