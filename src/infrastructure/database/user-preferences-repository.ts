import { eq } from "drizzle-orm";
import type { UserPreferencesRepository } from "../../application/users/user-preferences-repository.js";
import type { UserLocale } from "../../domain/users/user-locale.js";
import { userPreferences, users } from "./schema.js";
import type { BotDatabase } from "./client.js";

export class DrizzleUserPreferencesRepository implements UserPreferencesRepository {
  constructor(private readonly database: BotDatabase) {}

  async findLocale(discordUserId: string): Promise<UserLocale | null> {
    const [preference] = await this.database
      .select({ locale: userPreferences.locale })
      .from(userPreferences)
      .where(eq(userPreferences.userId, discordUserId))
      .limit(1);

    return preference?.locale ?? null;
  }

  async saveLocale(discordUserId: string, locale: UserLocale): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction
        .insert(users)
        .values({ discordUserId })
        .onConflictDoNothing();
      await transaction
        .insert(userPreferences)
        .values({ userId: discordUserId, locale })
        .onConflictDoUpdate({
          target: userPreferences.userId,
          set: { locale, updatedAt: new Date() },
        });
    });
  }
}
