export interface DailyTipPublicationRepository {
  claimPublication(
    dateUtc: string,
    guildId: string,
    slot: number,
    tipId: string,
  ): Promise<boolean>;
  markPublicationSent(
    dateUtc: string,
    guildId: string,
    slot: number,
    messageId: string,
  ): Promise<void>;
}
