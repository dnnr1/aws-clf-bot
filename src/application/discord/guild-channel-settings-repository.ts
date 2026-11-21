export interface StoredGuildChannelSettings {
  guildId: string;
  practiceChannelId: string | null;
  tipsChannelId: string | null;
}

export interface GuildChannelSettingsRepository {
  findByGuildId(guildId: string): Promise<StoredGuildChannelSettings | null>;
  setPracticeChannel(guildId: string, channelId: string): Promise<void>;
  setTipsChannel(guildId: string, channelId: string): Promise<void>;
}
