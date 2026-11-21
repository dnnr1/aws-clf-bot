import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  max,
  ne,
  notExists,
  sql,
} from "drizzle-orm";
import { PracticeError } from "../../application/study/practice-error.js";
import type {
  PracticeRepository,
  PresentedQuestion,
  StartedPracticeAnswer,
  StartedExamSession,
  StartedPracticeSession,
} from "../../application/study/practice-repository.js";
import {
  isAnswerOptionKey,
  type AnswerFeedback,
  type AnswerOptionKey,
  type LocalizedText,
  type StudyQuestion,
} from "../../domain/study/question.js";
import {
  examDurationMinutes,
  examQuestionCount,
  examQuestionDistribution,
  selectUniqueExamQuestions,
} from "../../domain/study/exam-simulation.js";
import type { BotDatabase } from "./client.js";
import {
  awsServices,
  examDomainResults,
  examDomains,
  examResults,
  questionOptions,
  questionServices,
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

  async startSessionWithAnswer(
    discordUserId: string,
    questionId: string,
    optionKey: AnswerOptionKey,
  ): Promise<StartedPracticeAnswer> {
    return this.database.transaction(async (transaction) => {
      const session = await createPracticeSession(
        transaction,
        discordUserId,
        questionId,
      );
      const loaded = await loadQuestion(transaction, questionId);
      const selectedOption = loaded.question.options.find(
        (option) => option.key === optionKey,
      );

      if (!selectedOption) {
        throw new PracticeError("invalid_option");
      }

      const isCorrect = optionKey === loaded.correctOptionKey;
      await transaction.insert(userAnswers).values({
        sessionId: session.sessionId,
        sessionQuestionId: session.presentationId,
        questionId,
        selectedOptionKey: optionKey,
        isCorrect,
      });

      const answerCounts = await getSessionAnswerCounts(
        transaction,
        session.sessionId,
      );
      return {
        sessionId: session.sessionId,
        feedback: {
          mode: "practice",
          isCorrect,
          correctOptionKey: loaded.correctOptionKey,
          correctOptionText: loaded.correctOptionText,
          explanation: loaded.explanation,
          services: loaded.question.services,
          ...answerCounts,
        },
      };
    });
  }

  async getRandomQuestion(): Promise<StudyQuestion> {
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

      const loaded = await loadQuestion(transaction, candidate.id);
      return loaded.question;
    });
  }

  async restartSession(
    discordUserId: string,
    sessionId: string,
  ): Promise<StartedPracticeSession> {
    return this.database.transaction(async (transaction) => {
      const [session] = await transaction
        .select({
          userId: studySessions.userId,
          status: studySessions.status,
          mode: studySessions.mode,
        })
        .from(studySessions)
        .where(eq(studySessions.id, sessionId))
        .for("update");

      if (!session || session.userId !== discordUserId) {
        throw new PracticeError("session_not_found");
      }
      if (session.status !== "in_progress" || session.mode !== "practice") {
        throw new PracticeError("session_closed");
      }

      await transaction
        .update(studySessions)
        .set({ status: "abandoned", completedAt: new Date() })
        .where(eq(studySessions.id, sessionId));

      return createPracticeSession(transaction, discordUserId);
    });
  }

  async startExam(discordUserId: string): Promise<StartedExamSession> {
    return this.database.transaction(async (transaction) => {
      const selectedQuestionIds: string[] = [];

      for (const domain of examQuestionDistribution) {
        const domainQuestions = await transaction
          .select({
            id: questions.id,
            familyId: questions.familyId,
          })
          .from(questions)
          .where(
            and(
              eq(questions.certificationId, "aws-clf-c02"),
              eq(questions.domainId, domain.domainId),
              eq(questions.isActive, true),
            ),
          )
          .orderBy(sql`random()`);

        const selectedQuestions = selectUniqueExamQuestions(
          domainQuestions,
          domain.questionCount,
        );

        if (selectedQuestions.length < domain.questionCount) {
          throw new PracticeError("exam_not_available");
        }

        selectedQuestionIds.push(...selectedQuestions.map(({ id }) => id));
      }

      const examQuestions = await transaction
        .select({ id: questions.id })
        .from(questions)
        .where(inArray(questions.id, selectedQuestionIds))
        .orderBy(sql`random()`);
      await transaction
        .insert(users)
        .values({ discordUserId })
        .onConflictDoNothing();

      const expiresAt = new Date(Date.now() + examDurationMinutes * 60_000);
      const [session] = await transaction
        .insert(studySessions)
        .values({
          userId: discordUserId,
          certificationId: "aws-clf-c02",
          mode: "exam_simulation" as const,
          expiresAt,
        })
        .returning({ id: studySessions.id });

      if (!session) {
        throw new Error("The exam session was not created.");
      }

      await transaction.insert(sessionQuestions).values(
        examQuestions.map((question, index) => ({
          sessionId: session.id,
          questionId: question.id,
          position: index + 1,
        })),
      );

      const [firstQuestion] = await transaction
        .select({
          presentationId: sessionQuestions.id,
          questionId: sessionQuestions.questionId,
        })
        .from(sessionQuestions)
        .where(
          and(
            eq(sessionQuestions.sessionId, session.id),
            eq(sessionQuestions.position, 1),
          ),
        );

      if (!firstQuestion) {
        throw new Error("The exam question pool changed unexpectedly.");
      }

      const loaded = await loadQuestion(transaction, firstQuestion.questionId);
      return {
        sessionId: session.id,
        presentationId: firstQuestion.presentationId,
        question: loaded.question,
        mode: "exam_simulation" as const,
        position: 1,
        totalQuestions: examQuestionCount,
        expiresAt,
        correctCount: 0,
        incorrectCount: 0,
        questionCount: examQuestionCount,
      };
    });
  }

  async getNextQuestion(
    discordUserId: string,
    sessionId: string,
  ): Promise<PresentedQuestion | null> {
    const result = await this.database.transaction(async (transaction) => {
      const [session] = await transaction
        .select({
          userId: studySessions.userId,
          certificationId: studySessions.certificationId,
          status: studySessions.status,
          mode: studySessions.mode,
          expiresAt: studySessions.expiresAt,
        })
        .from(studySessions)
        .where(eq(studySessions.id, sessionId))
        .for("update");

      if (!session || session.userId !== discordUserId) {
        throw new PracticeError("session_not_found");
      }
      if (
        session.mode === "exam_simulation" &&
        session.expiresAt &&
        session.expiresAt.getTime() <= Date.now()
      ) {
        await transaction
          .update(studySessions)
          .set({ status: "expired", completedAt: new Date() })
          .where(eq(studySessions.id, sessionId));
        return "exam_expired" as const;
      }
      if (session.status !== "in_progress") {
        throw new PracticeError("session_closed");
      }
      if (session.mode !== "practice" && session.mode !== "exam_simulation") {
        throw new PracticeError("session_closed");
      }

      const answerCounts = await getSessionAnswerCounts(transaction, sessionId);
      const [pendingQuestion] = await transaction
        .select({
          presentationId: sessionQuestions.id,
          questionId: sessionQuestions.questionId,
          position: sessionQuestions.position,
        })
        .from(sessionQuestions)
        .leftJoin(
          userAnswers,
          and(
            eq(userAnswers.sessionId, sessionQuestions.sessionId),
            eq(userAnswers.sessionQuestionId, sessionQuestions.id),
          ),
        )
        .where(
          and(
            eq(sessionQuestions.sessionId, sessionId),
            isNull(userAnswers.sessionQuestionId),
          ),
        )
        .orderBy(asc(sessionQuestions.position))
        .limit(1);

      if (pendingQuestion) {
        const loaded = await loadQuestion(
          transaction,
          pendingQuestion.questionId,
        );
        return {
          presentationId: pendingQuestion.presentationId,
          question: loaded.question,
          mode: session.mode,
          position: pendingQuestion.position,
          totalQuestions:
            session.mode === "exam_simulation" ? examQuestionCount : null,
          expiresAt: session.expiresAt,
          ...answerCounts,
        };
      }

      if (session.mode === "exam_simulation") {
        return null;
      }

      const [lastPresentation] = await transaction
        .select({ questionId: sessionQuestions.questionId })
        .from(sessionQuestions)
        .where(eq(sessionQuestions.sessionId, sessionId))
        .orderBy(desc(sessionQuestions.position))
        .limit(1);

      const [unseenCandidate] = await transaction
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

      let candidate = unseenCandidate;
      if (!candidate) {
        const [differentQuestion] = await transaction
          .select({ id: questions.id })
          .from(questions)
          .where(
            and(
              eq(questions.certificationId, session.certificationId),
              eq(questions.isActive, true),
              lastPresentation
                ? ne(questions.id, lastPresentation.questionId)
                : undefined,
            ),
          )
          .orderBy(sql`random()`)
          .limit(1);

        candidate = differentQuestion;
      }

      if (!candidate && lastPresentation) {
        const [onlyQuestion] = await transaction
          .select({ id: questions.id })
          .from(questions)
          .where(
            and(
              eq(questions.certificationId, session.certificationId),
              eq(questions.isActive, true),
            ),
          )
          .orderBy(sql`random()`)
          .limit(1);
        candidate = onlyQuestion;
      }

      if (!candidate) {
        throw new PracticeError("no_questions_available");
      }

      const [lastPosition] = await transaction
        .select({ value: max(sessionQuestions.position) })
        .from(sessionQuestions)
        .where(eq(sessionQuestions.sessionId, sessionId));

      const position = (lastPosition?.value ?? 0) + 1;
      const [presentation] = await transaction
        .insert(sessionQuestions)
        .values({
          sessionId,
          questionId: candidate.id,
          position,
        })
        .returning({ id: sessionQuestions.id });

      if (!presentation) {
        throw new Error("The next practice question was not presented.");
      }

      const loaded = await loadQuestion(transaction, candidate.id);
      return {
        presentationId: presentation.id,
        question: loaded.question,
        mode: "practice" as const,
        position,
        totalQuestions: null,
        expiresAt: null,
        ...answerCounts,
      };
    });

    if (result === "exam_expired") {
      throw new PracticeError("exam_expired");
    }

    return result;
  }

  async submitAnswer(
    discordUserId: string,
    sessionId: string,
    presentationId: string,
    optionKey: AnswerOptionKey,
  ): Promise<AnswerFeedback> {
    const result = await this.database.transaction(async (transaction) => {
      const [session] = await transaction
        .select({
          userId: studySessions.userId,
          status: studySessions.status,
          mode: studySessions.mode,
          startedAt: studySessions.startedAt,
          expiresAt: studySessions.expiresAt,
        })
        .from(studySessions)
        .where(eq(studySessions.id, sessionId))
        .for("update");

      if (!session || session.userId !== discordUserId) {
        throw new PracticeError("session_not_found");
      }
      if (
        session.mode === "exam_simulation" &&
        session.expiresAt &&
        session.expiresAt.getTime() <= Date.now()
      ) {
        await transaction
          .update(studySessions)
          .set({ status: "expired", completedAt: new Date() })
          .where(eq(studySessions.id, sessionId));
        return { expired: true as const };
      }
      if (session.status !== "in_progress") {
        throw new PracticeError("session_closed");
      }
      if (session.mode !== "practice" && session.mode !== "exam_simulation") {
        throw new PracticeError("session_closed");
      }

      const [existingAnswer] = await transaction
        .select({ sessionQuestionId: userAnswers.sessionQuestionId })
        .from(userAnswers)
        .where(
          and(
            eq(userAnswers.sessionId, sessionId),
            eq(userAnswers.sessionQuestionId, presentationId),
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
            eq(sessionQuestions.id, presentationId),
          ),
        )
        .limit(1);

      if (!sessionQuestion) {
        throw new PracticeError("question_not_in_session");
      }

      const questionId = sessionQuestion.questionId;
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
        sessionQuestionId: presentationId,
        questionId,
        selectedOptionKey: optionKey,
        isCorrect,
      });

      const answerCounts = await getSessionAnswerCounts(transaction, sessionId);
      const feedback: AnswerFeedback = {
        mode: session.mode,
        isCorrect,
        correctOptionKey: loaded.correctOptionKey,
        correctOptionText: loaded.correctOptionText,
        explanation: loaded.explanation,
        services: loaded.question.services,
        ...answerCounts,
      };

      if (session.mode !== "exam_simulation") {
        return feedback;
      }

      const examResult = await completeExamIfAnswered(
        transaction,
        sessionId,
        session.startedAt,
      );

      return examResult ? { ...feedback, examResult } : feedback;
    });

    if ("expired" in result) {
      throw new PracticeError("exam_expired");
    }

    return result;
  }
}

async function createPracticeSession(
  transaction: BotTransaction,
  discordUserId: string,
  initialQuestionId?: string,
): Promise<StartedPracticeSession> {
  const questionQuery = transaction
    .select({ id: questions.id })
    .from(questions)
    .where(
      and(
        eq(questions.certificationId, "aws-clf-c02"),
        eq(questions.isActive, true),
        initialQuestionId ? eq(questions.id, initialQuestionId) : undefined,
      ),
    );
  const [candidate] = await (
    initialQuestionId ? questionQuery : questionQuery.orderBy(sql`random()`)
  ).limit(1);

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

  const [presentation] = await transaction
    .insert(sessionQuestions)
    .values({
      sessionId: session.id,
      questionId: candidate.id,
      position: 1,
    })
    .returning({ id: sessionQuestions.id });

  if (!presentation) {
    throw new Error("The first practice question was not presented.");
  }

  const loaded = await loadQuestion(transaction, candidate.id);
  return {
    sessionId: session.id,
    presentationId: presentation.id,
    question: loaded.question,
    correctCount: 0,
    incorrectCount: 0,
  };
}

async function getSessionAnswerCounts(
  transaction: BotTransaction,
  sessionId: string,
): Promise<{ correctCount: number; incorrectCount: number }> {
  const [counts] = await transaction
    .select({
      correctCount: sql<number>`count(*) filter (where ${userAnswers.isCorrect})::int`,
      incorrectCount: sql<number>`count(*) filter (where not ${userAnswers.isCorrect})::int`,
    })
    .from(userAnswers)
    .where(eq(userAnswers.sessionId, sessionId));

  return counts ?? { correctCount: 0, incorrectCount: 0 };
}

async function completeExamIfAnswered(
  transaction: BotTransaction,
  sessionId: string,
  startedAt: Date,
) {
  const [summary] = await transaction
    .select({
      answerCount: sql<number>`count(*)::int`,
      correctCount: sql<number>`count(*) filter (where ${userAnswers.isCorrect})::int`,
    })
    .from(userAnswers)
    .where(eq(userAnswers.sessionId, sessionId));

  if (!summary || summary.answerCount < examQuestionCount) {
    return null;
  }
  if (summary.answerCount > examQuestionCount) {
    throw new Error("The exam contains more answers than questions.");
  }

  const domainResults = await transaction
    .select({
      domainId: examDomains.id,
      nameEn: examDomains.nameEn,
      namePtBr: examDomains.namePtBr,
      correctCount: sql<number>`count(*) filter (where ${userAnswers.isCorrect})::int`,
      questionCount: sql<number>`count(*)::int`,
    })
    .from(sessionQuestions)
    .innerJoin(questions, eq(questions.id, sessionQuestions.questionId))
    .innerJoin(
      userAnswers,
      and(
        eq(userAnswers.sessionId, sessionQuestions.sessionId),
        eq(userAnswers.sessionQuestionId, sessionQuestions.id),
      ),
    )
    .innerJoin(examDomains, eq(examDomains.id, questions.domainId))
    .where(eq(sessionQuestions.sessionId, sessionId))
    .groupBy(examDomains.id, examDomains.nameEn, examDomains.namePtBr)
    .orderBy(examDomains.id);
  const completedAt = new Date();
  const accuracyPercentage = (summary.correctCount / examQuestionCount) * 100;
  const durationSeconds = Math.floor(
    (completedAt.getTime() - startedAt.getTime()) / 1000,
  );

  await transaction.insert(examResults).values({
    sessionId,
    correctCount: summary.correctCount,
    questionCount: examQuestionCount,
    accuracy: accuracyPercentage.toFixed(2),
    completedAt,
  });
  await transaction.insert(examDomainResults).values(
    domainResults.map((result) => ({
      sessionId,
      domainId: result.domainId,
      correctCount: result.correctCount,
      questionCount: result.questionCount,
    })),
  );
  await transaction
    .update(studySessions)
    .set({ status: "completed", completedAt })
    .where(eq(studySessions.id, sessionId));

  return {
    correctCount: summary.correctCount,
    questionCount: examQuestionCount,
    accuracyPercentage,
    durationSeconds,
    domainResults: domainResults.map((result) => ({
      domainId: result.domainId,
      domainName: { en: result.nameEn, "pt-BR": result.namePtBr },
      correctCount: result.correctCount,
      questionCount: result.questionCount,
    })),
  };
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
  const relatedServices = await transaction
    .select({ name: awsServices.name })
    .from(questionServices)
    .innerJoin(awsServices, eq(awsServices.id, questionServices.serviceId))
    .where(eq(questionServices.questionId, questionId))
    .orderBy(asc(awsServices.name));

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
      services: relatedServices.map(({ name }) => name),
    },
    correctOptionKey,
    correctOptionText: correctOption.text,
    explanation: {
      en: question.explanationEn,
      "pt-BR": question.explanationPtBr,
    },
  };
}
