import {
  isUserLocale,
  type UserLocale,
} from "../../domain/users/user-locale.js";
import type { UserPreferencesRepository } from "./user-preferences-repository.js";

export class UserPreferencesService {
  constructor(private readonly repository: UserPreferencesRepository) {}

  async getLocale(discordUserId: string): Promise<UserLocale> {
    return (await this.repository.findLocale(discordUserId)) ?? "pt-BR";
  }

  async changeLocale(discordUserId: string, locale: unknown): Promise<void> {
    if (!isUserLocale(locale)) {
      throw new Error("Unsupported user locale.");
    }

    await this.repository.saveLocale(discordUserId, locale);
  }
}
