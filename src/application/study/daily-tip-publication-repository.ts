export interface DailyTipPublicationRepository {
  claimPublication(
    dateUtc: string,
    slot: number,
    tipId: string,
  ): Promise<boolean>;
  markPublicationSent(
    dateUtc: string,
    slot: number,
    messageId: string,
  ): Promise<void>;
}
