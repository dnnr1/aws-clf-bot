import { eq } from "drizzle-orm";
import type { BotChannelMessageRepository } from "../../application/discord/bot-channel-message-repository.js";
import type { BotDatabase } from "./client.js";
import { botChannelMessages } from "./schema.js";

export class DrizzleBotChannelMessageRepository implements BotChannelMessageRepository {
  constructor(private readonly database: BotDatabase) {}

  async findMessage(key: string) {
    const [message] = await this.database
      .select({
        channelId: botChannelMessages.channelId,
        messageId: botChannelMessages.messageId,
      })
      .from(botChannelMessages)
      .where(eq(botChannelMessages.key, key))
      .limit(1);

    return message ?? null;
  }

  async saveMessage(
    key: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await this.database
      .insert(botChannelMessages)
      .values({ key, channelId, messageId })
      .onConflictDoUpdate({
        target: botChannelMessages.key,
        set: { channelId, messageId, updatedAt: new Date() },
      });
  }
}
