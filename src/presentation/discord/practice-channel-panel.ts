import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
  const panelMessage = createPracticePanelMessage();

  if (storedMessage?.channelId === channel.id) {
    try {
      const message = await channel.messages.fetch(storedMessage.messageId);

      if (message.author.id !== client.user?.id) {
        throw new Error(
          "The stored practice introduction message is not owned by this bot.",
        );
      }

      await message.edit(panelMessage);
      return;
    } catch (error) {
      if (!(error instanceof DiscordAPIError) || error.code !== 10008) {
        throw error;
      }
    }
  }

  const message = await channel.send(panelMessage);
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

function createPracticePanelMessage() {
  const startButton = new ButtonBuilder()
    .setCustomId("start-practice")
    .setLabel("Iniciar os exercícios / Start exercises")
    .setStyle(ButtonStyle.Success);

  return {
    embeds: [createPracticePanel()],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(startButton),
    ],
    allowedMentions: { parse: [] },
  };
}

function createPracticePanel(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Boas-vindas ao AWS CLF Study Bot")
    .setDescription(
      "Clique em **Iniciar os exercícios** para começar sua sessão contínua e privada.",
    )
    .addFields(
      {
        name: "Praticar",
        value:
          "Sua resposta, resultado e sequência de questões são privados. `/exam` inicia uma simulação cronometrada de 65 questões em 90 minutos.",
      },
      {
        name: "Comandos",
        value:
          "`/stats` mostra seu progresso.\n`/language` altera seu idioma.\n`/help` lista os comandos disponíveis.",
      },
      {
        name: "Welcome",
        value:
          "Click **Start exercises** to begin your own private, continuous practice session.",
      },
    );
}
