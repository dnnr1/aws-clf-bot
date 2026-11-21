import { eq, sql } from "drizzle-orm";
import type { StatisticsRepository } from "../../application/study/statistics-repository.js";
import type { BotDatabase } from "./client.js";
import { studySessions, userAnswers } from "./schema.js";

const utcActivityDate = sql<string>`to_char(${userAnswers.answeredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

export class DrizzleStatisticsRepository implements StatisticsRepository {
  constructor(private readonly database: BotDatabase) {}

  async getStudyStatistics(discordUserId: string) {
    const [answerSummary] = await this.database
      .select({
        totalAnswers: sql<number>`count(*)::int`,
        correctAnswers: sql<number>`count(*) filter (where ${userAnswers.isCorrect})::int`,
      })
      .from(userAnswers)
      .innerJoin(studySessions, eq(studySessions.id, userAnswers.sessionId))
      .where(eq(studySessions.userId, discordUserId));
    const [sessionSummary] = await this.database
      .select({ totalSessions: sql<number>`count(*)::int` })
      .from(studySessions)
      .where(eq(studySessions.userId, discordUserId));
    const activityDates = await this.database
      .select({ activityDateUtc: utcActivityDate })
      .from(userAnswers)
      .innerJoin(studySessions, eq(studySessions.id, userAnswers.sessionId))
      .where(eq(studySessions.userId, discordUserId))
      .groupBy(utcActivityDate)
      .orderBy(utcActivityDate);

    return {
      totalAnswers: answerSummary?.totalAnswers ?? 0,
      correctAnswers: answerSummary?.correctAnswers ?? 0,
      totalSessions: sessionSummary?.totalSessions ?? 0,
      activityDatesUtc: activityDates.map(
        (activity) => activity.activityDateUtc,
      ),
    };
  }
}
