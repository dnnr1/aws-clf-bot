import { and, eq } from "drizzle-orm";
import type { DailyTipPublicationRepository } from "../../application/study/daily-tip-publication-repository.js";
import type { BotDatabase } from "./client.js";
import { dailyTipPublications } from "./schema.js";

export class DrizzleDailyTipPublicationRepository implements DailyTipPublicationRepository {
  constructor(private readonly database: BotDatabase) {}

  async claimPublication(
    dateUtc: string,
    slot: number,
    tipId: string,
  ): Promise<boolean> {
    const [publication] = await this.database
      .insert(dailyTipPublications)
      .values({ tipDate: dateUtc, slot, tipId })
      .onConflictDoNothing()
      .returning({ tipDate: dailyTipPublications.tipDate });

    return publication !== undefined;
  }

  async markPublicationSent(
    dateUtc: string,
    slot: number,
    messageId: string,
  ): Promise<void> {
    await this.database
      .update(dailyTipPublications)
      .set({ messageId, sentAt: new Date() })
      .where(
        and(
          eq(dailyTipPublications.tipDate, dateUtc),
          eq(dailyTipPublications.slot, slot),
        ),
      );
  }
}
