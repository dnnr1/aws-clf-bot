import { readFile } from "node:fs/promises";
import { createDatabase } from "./client.js";
import { seedQuestionBank } from "./seed-question-bank.js";
import { logger } from "../logging/logger.js";
import { parseQuestionBank } from "../questions/question-bank-schema.js";

async function seed(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set before seeding the question bank.",
    );
  }

  const { database, pool } = createDatabase(databaseUrl);
  pool.on("error", (error) => logger.error("database.pool_error", error));

  try {
    const bankFileUrl = new URL(
      "../../../data/questions/clf-c02.json",
      import.meta.url,
    );
    const bankContents = await readFile(bankFileUrl, "utf8");
    const questionBank = parseQuestionBank(JSON.parse(bankContents));
    const insertedQuestionCount = await seedQuestionBank(
      database,
      questionBank,
    );

    logger.info("question_bank.seeded", {
      insertedQuestionCount: String(insertedQuestionCount),
      validatedQuestionCount: String(questionBank.length),
    });
  } finally {
    await pool.end();
  }
}

void seed().catch((error: unknown) => {
  logger.error("question_bank.seed_failed", error);
  process.exitCode = 1;
});
