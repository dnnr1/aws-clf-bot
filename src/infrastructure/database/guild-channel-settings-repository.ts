import { eq } from "drizzle-orm";
import type { GuildChannelSettingsRepository } from "../../application/discord/guild-channel-settings-repository.js";
import type { BotDatabase } from "./client.js";
import { guildChannelSettings } from "./schema.js";

export class DrizzleGuildChannelSettingsRepository implements GuildChannelSettingsRepository {
  constructor(private readonly database: BotDatabase) {}

  async findByGuildId(guildId: string) {
    const [settings] = await this.database
      .select({
        guildId: guildChannelSettings.guildId,
        practiceChannelId: guildChannelSettings.practiceChannelId,
        tipsChannelId: guildChannelSettings.tipsChannelId,
      })
      .from(guildChannelSettings)
      .where(eq(guildChannelSettings.guildId, guildId))
      .limit(1);

    return settings ?? null;
  }

  async setPracticeChannel(guildId: string, channelId: string): Promise<void> {
    await this.database
      .insert(guildChannelSettings)
      .values({ guildId, practiceChannelId: channelId })
      .onConflictDoUpdate({
        target: guildChannelSettings.guildId,
        set: { practiceChannelId: channelId, updatedAt: new Date() },
      });
  }

  async setTipsChannel(guildId: string, channelId: string): Promise<void> {
    await this.database
      .insert(guildChannelSettings)
      .values({ guildId, tipsChannelId: channelId })
      .onConflictDoUpdate({
        target: guildChannelSettings.guildId,
        set: { tipsChannelId: channelId, updatedAt: new Date() },
      });
  }
}
