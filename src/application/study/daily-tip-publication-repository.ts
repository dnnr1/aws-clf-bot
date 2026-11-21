export interface DailyTipPublicationRepository {
  hasPublicationForChannel(
    dateUtc: string,
    guildId: string,
    channelId: string,
  ): Promise<boolean>;
  claimInitialPublication(
    dateUtc: string,
    guildId: string,
    channelId: string,
    tipId: string,
  ): Promise<boolean>;
  claimPublication(
    dateUtc: string,
    guildId: string,
    slot: number,
    channelId: string,
    tipId: string,
  ): Promise<boolean>;
  markPublicationSent(
    dateUtc: string,
    guildId: string,
    slot: number,
    messageId: string,
  ): Promise<void>;
}
