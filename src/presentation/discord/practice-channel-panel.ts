import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  DiscordAPIError,
  EmbedBuilder,
  TextChannel,
  type Client,
} from "discord.js";
import type { BotChannelMessageRepository } from "../../application/discord/bot-channel-message-repository.js";
import type { PracticeService } from "../../application/study/practice-service.js";
import { PracticeError } from "../../application/study/practice-error.js";
import type { UserPreferencesService } from "../../application/users/user-preferences-service.js";
import { type UserLocale } from "../../domain/users/user-locale.js";
import { renderQuestion } from "./interaction-handler.js";

export async function maintainPracticeChannelPanel(
  client: Client,
  guildId: string,
  channelId: string,
  messages: BotChannelMessageRepository,
  practiceService: PracticeService,
  preferences: UserPreferencesService,
  discordUserId?: string,
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

  if (discordUserId) {
    await startPracticeSessionForPanel(
      client,
      channel,
      guildId,
      discordUserId,
      practiceService,
      preferences,
      messages,
    );
    return;
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

async function startPracticeSessionForPanel(
  client: Client,
  channel: TextChannel,
  guildId: string,
  discordUserId: string,
  practiceService: PracticeService,
  preferences: UserPreferencesService,
  messages: BotChannelMessageRepository,
): Promise<void> {
  const panelKey = `practice-active-${guildId}-${discordUserId}`;
  const storedMessage = await messages.findMessage(panelKey);
  const locale = (await preferences.getLocale(discordUserId)) as UserLocale;

  let session;

  try {
    session = await practiceService.start(discordUserId);
  } catch (error) {
    if (
      error instanceof PracticeError &&
      error.code === "no_questions_available"
    ) {
      const content =
        locale === "en"
          ? "No study questions are available yet. Please try again later."
          : "Ainda não há questões de estudo disponíveis. Tente novamente mais tarde.";

      if (storedMessage?.channelId === channel.id) {
        try {
          const message = await channel.messages.fetch(storedMessage.messageId);
          if (message.author.id === client.user?.id) {
            await message.edit({ content, embeds: [], components: [] });
          }
        } catch {
          await channel.send(content);
        }
      } else {
        await channel.send(content);
      }
      return;
    }
    throw error;
  }

  const rendered = renderQuestion(
    session.sessionId,
    discordUserId,
    session.question,
    locale,
    session,
  );

  if (storedMessage?.channelId === channel.id) {
    try {
      const message = await channel.messages.fetch(storedMessage.messageId);
      if (message.author.id === client.user?.id) {
        await message.edit(rendered);
        return;
      }
    } catch {
      // message not found, fall through to send
    }
  }

  const message = await channel.send(rendered);
  await messages.saveMessage(panelKey, channel.id, message.id);

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
