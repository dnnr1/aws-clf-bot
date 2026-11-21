import { and, eq, inArray } from "drizzle-orm";
import type { QuestionBank } from "../questions/question-bank-schema.js";
import type { BotDatabase } from "./client.js";
import {
  awsServices,
  examObjectives,
  questionObjectives,
  questionOptions,
  questionServices,
  questionSources,
  questions,
} from "./schema.js";

export async function seedQuestionBank(
  database: BotDatabase,
  questionBank: QuestionBank,
): Promise<number> {
  return database.transaction(async (transaction) => {
    let insertedQuestionCount = 0;

    for (const question of questionBank) {
      const [insertedQuestion] = await transaction
        .insert(questions)
        .values({
          id: question.id,
          familyId: question.familyId,
          certificationId: question.certificationId,
          domainId: question.domainId,
          difficulty: question.difficulty,
          promptEn: question.prompt.en,
          promptPtBr: question.prompt["pt-BR"],
          explanationEn: question.explanation.en,
          explanationPtBr: question.explanation["pt-BR"],
          correctOptionKey: question.correctOptionKey,
        })
        .onConflictDoNothing()
        .returning({ id: questions.id });

      if (!insertedQuestion) {
        continue;
      }

      const objectives = await transaction
        .select({
          id: examObjectives.id,
          code: examObjectives.objectiveCode,
        })
        .from(examObjectives)
        .where(
          and(
            eq(examObjectives.certificationId, question.certificationId),
            inArray(examObjectives.objectiveCode, question.objectives),
          ),
        );
      const objectiveIdsByCode = new Map(
        objectives.map((objective) => [objective.code, objective.id]),
      );
      const missingObjectives = question.objectives.filter(
        (objectiveCode) => !objectiveIdsByCode.has(objectiveCode),
      );

      if (missingObjectives.length > 0) {
        throw new Error(
          `Question ${question.id} references unknown exam objectives: ${missingObjectives.join(", ")}.`,
        );
      }

      await transaction.insert(questionOptions).values(
        question.options.map((option) => ({
          questionId: question.id,
          optionKey: option.key,
          textEn: option.text.en,
          textPtBr: option.text["pt-BR"],
        })),
      );

      for (const service of question.services) {
        await transaction
          .insert(awsServices)
          .values(service)
          .onConflictDoUpdate({
            target: awsServices.id,
            set: { name: service.name },
          });
      }

      await transaction.insert(questionServices).values(
        question.services.map((service) => ({
          questionId: question.id,
          serviceId: service.id,
        })),
      );

      await transaction.insert(questionObjectives).values(
        question.objectives.map((objectiveCode) => {
          const objectiveId = objectiveIdsByCode.get(objectiveCode);

          if (!objectiveId) {
            throw new Error(
              `Question ${question.id} references unknown exam objective: ${objectiveCode}.`,
            );
          }

          return {
            questionId: question.id,
            objectiveId,
          };
        }),
      );

      await transaction.insert(questionSources).values(
        question.sources.map((source) => ({
          questionId: question.id,
          label: source.label,
          url: source.url,
        })),
      );

      insertedQuestionCount += 1;
    }

    return insertedQuestionCount;
  });
}
