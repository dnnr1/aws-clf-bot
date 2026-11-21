import type { UserLocale } from "../../domain/users/user-locale.js";

export interface UserPreferencesRepository {
  findLocale(discordUserId: string): Promise<UserLocale | null>;
  saveLocale(discordUserId: string, locale: UserLocale): Promise<void>;
}
