import {
  ChannelType,
  DiscordAPIError,
  EmbedBuilder,
  type Client,
} from "discord.js";
import type { BotChannelMessageRepository } from "../../application/discord/bot-channel-message-repository.js";

export async function maintainPracticeChannelPanel(
  client: Client,
  guildId: string,
  channelId: string,
  messages: BotChannelMessageRepository,
): Promise<void> {
  const channel = await client.channels.fetch(channelId);

  if (
    !channel ||
    channel.type !== ChannelType.GuildText ||
    channel.guildId !== guildId
  ) {
    throw new Error(
      "The practice channel must be a sendable text channel in the configured server.",
    );
  }

  const practicePanelKey = `practice-introduction-${guildId}`;
  const storedMessage = await messages.findMessage(practicePanelKey);

  if (storedMessage?.channelId === channel.id) {
    try {
      const message = await channel.messages.fetch(storedMessage.messageId);

      if (message.author.id !== client.user?.id) {
        throw new Error(
          "The stored practice introduction message is not owned by this bot.",
        );
      }

      await message.edit({ embeds: [createPracticePanel()] });
      return;
    } catch (error) {
      if (!(error instanceof DiscordAPIError) || error.code !== 10008) {
        throw error;
      }
    }
  }

  const message = await channel.send({ embeds: [createPracticePanel()] });
  await messages.saveMessage(practicePanelKey, channel.id, message.id);

  if (storedMessage && storedMessage.channelId !== channel.id) {
    await removePreviousPanel(client, storedMessage);
  }
}

async function removePreviousPanel(
  client: Client,
  storedMessage: { channelId: string; messageId: string },
): Promise<void> {
  let channel;

  try {
    channel = await client.channels.fetch(storedMessage.channelId);
  } catch (error) {
    if (error instanceof DiscordAPIError && error.code === 10003) {
      return;
    }

    throw error;
  }

  if (!channel || channel.type !== ChannelType.GuildText) {
    return;
  }

  let message;

  try {
    message = await channel.messages.fetch(storedMessage.messageId);
  } catch (error) {
    if (error instanceof DiscordAPIError && error.code === 10008) {
      return;
    }

    throw error;
  }

  if (message.author.id !== client.user?.id) {
    throw new Error(
      "The stored practice introduction message is not owned by this bot.",
    );
  }

  await message.delete();
}

function createPracticePanel(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Boas-vindas ao AWS CLF Study Bot")
    .setDescription(
      "Use os comandos abaixo para estudar. Questões, respostas, estatísticas e erros são visíveis somente para você.",
    )
    .addFields(
      {
        name: "Praticar",
        value:
          "`/practice` responde questões individuais.\n`/exam` inicia uma simulação de 65 questões em até 90 minutos.",
      },
      {
        name: "Comandos",
        value:
          "`/stats` mostra seu progresso.\n`/language` altera seu idioma.\n`/help` lista os comandos disponíveis.",
      },
      {
        name: "Welcome",
        value:
          "Study commands send private replies, so your questions and progress do not clutter this channel.",
      },
    );
}
