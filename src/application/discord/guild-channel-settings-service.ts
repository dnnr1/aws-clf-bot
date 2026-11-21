import type { GuildChannelSettingsRepository } from "./guild-channel-settings-repository.js";

export interface GuildChannelSettings {
  practiceChannelId: string | null;
  tipsChannelId: string | null;
}

export interface EnvironmentChannelDefaults extends GuildChannelSettings {
  guildId: string | undefined;
}

export class GuildChannelSettingsService {
  private readonly cache = new Map<string, GuildChannelSettings>();

  constructor(
    private readonly repository: GuildChannelSettingsRepository,
    private readonly defaults: EnvironmentChannelDefaults,
  ) {}

  async getSettings(guildId: string): Promise<GuildChannelSettings> {
    const cached = this.cache.get(guildId);

    if (cached) {
      return cached;
    }

    const stored = await this.repository.findByGuildId(guildId);
    const appliesDefaults = this.defaults.guildId === guildId;

    const settings = {
      practiceChannelId:
        stored?.practiceChannelId ??
        (appliesDefaults ? this.defaults.practiceChannelId : null),
      tipsChannelId:
        stored?.tipsChannelId ??
        (appliesDefaults ? this.defaults.tipsChannelId : null),
    };
    this.cache.set(guildId, settings);
    return settings;
  }

  async setPracticeChannel(guildId: string, channelId: string): Promise<void> {
    const settings = await this.getSettings(guildId);
    await this.repository.setPracticeChannel(guildId, channelId);
    const current = this.cache.get(guildId) ?? settings;
    this.cache.set(guildId, { ...current, practiceChannelId: channelId });
  }

  async setTipsChannel(guildId: string, channelId: string): Promise<void> {
    const settings = await this.getSettings(guildId);
    await this.repository.setTipsChannel(guildId, channelId);
    const current = this.cache.get(guildId) ?? settings;
    this.cache.set(guildId, { ...current, tipsChannelId: channelId });
  }
}
