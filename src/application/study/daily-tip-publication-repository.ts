export interface DailyTipPublicationRepository {
  claimInitialPublication(
    dateUtc: string,
    guildId: string,
    tipId: string,
  ): Promise<boolean>;
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
