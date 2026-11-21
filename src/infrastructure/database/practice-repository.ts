import { and, asc, eq, isNull, max, notExists, sql } from "drizzle-orm";
import { PracticeError } from "../../application/study/practice-error.js";
import type { PracticeRepository } from "../../application/study/practice-repository.js";
import {
  isAnswerOptionKey,
  type AnswerFeedback,
  type AnswerOptionKey,
  type LocalizedText,
  type StudyQuestion,
} from "../../domain/study/question.js";
import type { BotDatabase } from "./client.js";
import {
  questionOptions,
  questions,
  sessionQuestions,
  studySessions,
  userAnswers,
  users,
} from "./schema.js";

type BotTransaction = Parameters<Parameters<BotDatabase["transaction"]>[0]>[0];

interface LoadedQuestion {
  question: StudyQuestion;
  correctOptionKey: AnswerOptionKey;
  correctOptionText: LocalizedText;
  explanation: LocalizedText;
}

export class DrizzlePracticeRepository implements PracticeRepository {
  constructor(private readonly database: BotDatabase) {}

  async startSession(
    discordUserId: string,
  ): Promise<{ sessionId: string; question: StudyQuestion }> {
    return this.database.transaction(async (transaction) => {
      const [candidate] = await transaction
        .select({ id: questions.id })
        .from(questions)
        .where(
          and(
            eq(questions.certificationId, "aws-clf-c02"),
            eq(questions.isActive, true),
          ),
        )
        .orderBy(sql`random()`)
        .limit(1);

      if (!candidate) {
        throw new PracticeError("no_questions_available");
      }

      await transaction
        .insert(users)
        .values({ discordUserId })
        .onConflictDoNothing();

      const [session] = await transaction
        .insert(studySessions)
        .values({
          userId: discordUserId,
          certificationId: "aws-clf-c02",
          mode: "practice",
        })
        .returning({ id: studySessions.id });

      if (!session) {
        throw new Error("The practice session was not created.");
      }

      await transaction.insert(sessionQuestions).values({
        sessionId: session.id,
        questionId: candidate.id,
        position: 1,
      });

      const loaded = await loadQuestion(transaction, candidate.id);
      return { sessionId: session.id, question: loaded.question };
    });
  }

  async getNextQuestion(
    discordUserId: string,
    sessionId: string,
  ): Promise<StudyQuestion | null> {
    return this.database.transaction(async (transaction) => {
      const [session] = await transaction
        .select({
          userId: studySessions.userId,
          certificationId: studySessions.certificationId,
          status: studySessions.status,
        })
        .from(studySessions)
        .where(eq(studySessions.id, sessionId))
        .for("update");

      if (!session || session.userId !== discordUserId) {
        throw new PracticeError("session_not_found");
      }
      if (session.status !== "in_progress") {
        throw new PracticeError("session_closed");
      }

      const [pendingQuestion] = await transaction
        .select({ questionId: sessionQuestions.questionId })
        .from(sessionQuestions)
        .leftJoin(
          userAnswers,
          and(
            eq(userAnswers.sessionId, sessionQuestions.sessionId),
            eq(userAnswers.questionId, sessionQuestions.questionId),
          ),
        )
        .where(
          and(
            eq(sessionQuestions.sessionId, sessionId),
            isNull(userAnswers.questionId),
          ),
        )
        .orderBy(asc(sessionQuestions.position))
        .limit(1);

      if (pendingQuestion) {
        const loaded = await loadQuestion(
          transaction,
          pendingQuestion.questionId,
        );
        return loaded.question;
      }

      const [candidate] = await transaction
        .select({ id: questions.id })
        .from(questions)
        .where(
          and(
            eq(questions.certificationId, session.certificationId),
            eq(questions.isActive, true),
            notExists(
              transaction
                .select({ questionId: sessionQuestions.questionId })
                .from(sessionQuestions)
                .where(
                  and(
                    eq(sessionQuestions.sessionId, sessionId),
                    eq(sessionQuestions.questionId, questions.id),
                  ),
                ),
            ),
          ),
        )
        .orderBy(sql`random()`)
        .limit(1);

      if (!candidate) {
        await transaction
          .update(studySessions)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(studySessions.id, sessionId));
        return null;
      }

      const [lastPosition] = await transaction
        .select({ value: max(sessionQuestions.position) })
        .from(sessionQuestions)
        .where(eq(sessionQuestions.sessionId, sessionId));

      await transaction.insert(sessionQuestions).values({
        sessionId,
        questionId: candidate.id,
        position: (lastPosition?.value ?? 0) + 1,
      });

      const loaded = await loadQuestion(transaction, candidate.id);
      return loaded.question;
    });
  }

  async submitAnswer(
    discordUserId: string,
    sessionId: string,
    questionId: string,
    optionKey: AnswerOptionKey,
  ): Promise<AnswerFeedback> {
    return this.database.transaction(async (transaction) => {
      const [session] = await transaction
        .select({
          userId: studySessions.userId,
          status: studySessions.status,
        })
        .from(studySessions)
        .where(eq(studySessions.id, sessionId))
        .for("update");

      if (!session || session.userId !== discordUserId) {
        throw new PracticeError("session_not_found");
      }
      if (session.status !== "in_progress") {
        throw new PracticeError("session_closed");
      }

      const [existingAnswer] = await transaction
        .select({ questionId: userAnswers.questionId })
        .from(userAnswers)
        .where(
          and(
            eq(userAnswers.sessionId, sessionId),
            eq(userAnswers.questionId, questionId),
          ),
        )
        .limit(1);

      if (existingAnswer) {
        throw new PracticeError("already_answered");
      }

      const [sessionQuestion] = await transaction
        .select({ questionId: sessionQuestions.questionId })
        .from(sessionQuestions)
        .where(
          and(
            eq(sessionQuestions.sessionId, sessionId),
            eq(sessionQuestions.questionId, questionId),
          ),
        )
        .limit(1);

      if (!sessionQuestion) {
        throw new PracticeError("question_not_in_session");
      }

      const loaded = await loadQuestion(transaction, questionId);
      const selectedOption = loaded.question.options.find(
        (option) => option.key === optionKey,
      );

      if (!selectedOption) {
        throw new PracticeError("invalid_option");
      }

      const isCorrect = optionKey === loaded.correctOptionKey;

      await transaction.insert(userAnswers).values({
        sessionId,
        questionId,
        selectedOptionKey: optionKey,
        isCorrect,
      });

      return {
        isCorrect,
        correctOptionKey: loaded.correctOptionKey,
        correctOptionText: loaded.correctOptionText,
        explanation: loaded.explanation,
      };
    });
  }
}

async function loadQuestion(
  transaction: BotTransaction,
  questionId: string,
): Promise<LoadedQuestion> {
  const [question] = await transaction
    .select({
      id: questions.id,
      domainId: questions.domainId,
      promptEn: questions.promptEn,
      promptPtBr: questions.promptPtBr,
      correctOptionKey: questions.correctOptionKey,
      explanationEn: questions.explanationEn,
      explanationPtBr: questions.explanationPtBr,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question) {
    throw new Error(`Question ${questionId} does not exist.`);
  }

  const storedOptions = await transaction
    .select({
      key: questionOptions.optionKey,
      textEn: questionOptions.textEn,
      textPtBr: questionOptions.textPtBr,
    })
    .from(questionOptions)
    .where(eq(questionOptions.questionId, questionId))
    .orderBy(asc(questionOptions.optionKey));

  if (storedOptions.length !== 4) {
    throw new Error(
      `Question ${questionId} must have exactly four answer options.`,
    );
  }

  const options = storedOptions.map((option) => {
    if (!isAnswerOptionKey(option.key)) {
      throw new Error(
        `Question ${questionId} has an invalid answer option identifier.`,
      );
    }

    return {
      key: option.key,
      text: {
        en: option.textEn,
        "pt-BR": option.textPtBr,
      },
    };
  });
  const correctOptionKey = question.correctOptionKey;

  if (!isAnswerOptionKey(correctOptionKey)) {
    throw new Error(
      `Question ${questionId} has an invalid correct answer identifier.`,
    );
  }

  const correctOption = options.find(
    (option) => option.key === correctOptionKey,
  );

  if (!correctOption) {
    throw new Error(
      `Question ${questionId} has no matching correct answer option.`,
    );
  }

  return {
    question: {
      id: question.id,
      domainId: question.domainId,
      prompt: {
        en: question.promptEn,
        "pt-BR": question.promptPtBr,
      },
      options,
    },
    correctOptionKey,
    correctOptionText: correctOption.text,
    explanation: {
      en: question.explanationEn,
      "pt-BR": question.explanationPtBr,
    },
  };
}
