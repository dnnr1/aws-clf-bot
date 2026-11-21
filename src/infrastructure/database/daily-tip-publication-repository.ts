import { and, eq } from "drizzle-orm";
import type { DailyTipPublicationRepository } from "../../application/study/daily-tip-publication-repository.js";
import type { BotDatabase } from "./client.js";
import { dailyTipPublications } from "./schema.js";

export class DrizzleDailyTipPublicationRepository implements DailyTipPublicationRepository {
  constructor(private readonly database: BotDatabase) {}

  async hasPublicationForChannel(
    dateUtc: string,
    guildId: string,
    channelId: string,
  ): Promise<boolean> {
    const [publication] = await this.database
      .select({ slot: dailyTipPublications.slot })
      .from(dailyTipPublications)
      .where(
        and(
          eq(dailyTipPublications.tipDate, dateUtc),
          eq(dailyTipPublications.guildId, guildId),
          eq(dailyTipPublications.channelId, channelId),
        ),
      )
      .limit(1);

    return publication !== undefined;
  }

  async claimInitialPublication(
    dateUtc: string,
    guildId: string,
    channelId: string,
    tipId: string,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const [existingPublication] = await transaction
        .select({ slot: dailyTipPublications.slot })
        .from(dailyTipPublications)
        .where(
          and(
            eq(dailyTipPublications.tipDate, dateUtc),
            eq(dailyTipPublications.guildId, guildId),
          ),
        )
        .limit(1);

      if (existingPublication) {
        return false;
      }

      const [publication] = await transaction
        .insert(dailyTipPublications)
        .values({ tipDate: dateUtc, guildId, slot: 1, channelId, tipId })
        .onConflictDoNothing()
        .returning({ guildId: dailyTipPublications.guildId });

      return publication !== undefined;
    });
  }

  async claimPublication(
    dateUtc: string,
    guildId: string,
    slot: number,
    channelId: string,
    tipId: string,
  ): Promise<boolean> {
    const [publication] = await this.database
      .insert(dailyTipPublications)
      .values({ tipDate: dateUtc, guildId, slot, channelId, tipId })
      .onConflictDoNothing()
      .returning({ guildId: dailyTipPublications.guildId });

    return publication !== undefined;
  }

  async markPublicationSent(
    dateUtc: string,
    guildId: string,
    slot: number,
    messageId: string,
  ): Promise<void> {
    await this.database
      .update(dailyTipPublications)
      .set({ messageId, sentAt: new Date() })
      .where(
        and(
          eq(dailyTipPublications.tipDate, dateUtc),
          eq(dailyTipPublications.guildId, guildId),
          eq(dailyTipPublications.slot, slot),
        ),
      );
  }
}
