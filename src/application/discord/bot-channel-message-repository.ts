export interface StoredBotChannelMessage {
  channelId: string;
  messageId: string;
}

export interface BotChannelMessageRepository {
  findMessage(key: string): Promise<StoredBotChannelMessage | null>;
  saveMessage(key: string, channelId: string, messageId: string): Promise<void>;
}
