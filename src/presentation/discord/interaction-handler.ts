import {
  ActionRowBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type Interaction,
  type StringSelectMenuInteraction,
} from "discord.js";
import {
  isUserLocale,
  type UserLocale,
} from "../../domain/users/user-locale.js";
import type { UserPreferencesService } from "../../application/users/user-preferences-service.js";

const helpMessages: Record<UserLocale, string> = {
  en: [
    "**Available commands**",
    "`/help` - Show this command list.",
    "`/language` - Choose English or Portuguese (Brazil).",
  ].join("\n"),
  "pt-BR": [
    "**Comandos disponíveis**",
    "`/help` - Exibe esta lista de comandos.",
    "`/language` - Escolha English ou Português (Brasil).",
  ].join("\n"),
};

const languagePrompts: Record<UserLocale, string> = {
  en: "Choose the language used for your study experience.",
  "pt-BR": "Escolha o idioma usado na sua experiência de estudos.",
};

const languageSavedMessages: Record<UserLocale, string> = {
  en: "Your language has been set to English.",
  "pt-BR": "Seu idioma foi definido como Português (Brasil).",
};

const invalidComponentMessage =
  "This language menu is invalid. Run /language again. / Este menu de idioma é inválido. Use /language novamente.";
const unauthorizedComponentMessage =
  "This menu belongs to another user. / Este menu pertence a outro usuário.";
const invalidSelectionMessage =
  "Choose one of the listed languages. / Escolha um dos idiomas disponíveis.";

export async function handleDiscordInteraction(
  interaction: Interaction,
  preferences: UserPreferencesService,
): Promise<void> {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "help") {
      await handleHelpCommand(interaction, preferences);
    } else if (interaction.commandName === "language") {
      await handleLanguageCommand(interaction, preferences);
    }

    return;
  }

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId.startsWith("language:")
  ) {
    await handleLanguageSelection(interaction, preferences);
  }
}

async function handleHelpCommand(
  interaction: ChatInputCommandInteraction,
  preferences: UserPreferencesService,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const locale = await preferences.getLocale(interaction.user.id);
  await interaction.editReply(helpMessages[locale]);
}

async function handleLanguageCommand(
  interaction: ChatInputCommandInteraction,
  preferences: UserPreferencesService,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const locale = await preferences.getLocale(interaction.user.id);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`language:${interaction.user.id}`)
    .setPlaceholder(
      locale === "en" ? "Select a language" : "Selecione um idioma",
    )
    .addOptions(
      { label: "English", value: "en" },
      { label: "Português (Brasil)", value: "pt-BR" },
    );
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    menu,
  );

  await interaction.editReply({
    content: languagePrompts[locale],
    components: [row],
  });
}

async function handleLanguageSelection(
  interaction: StringSelectMenuInteraction,
  preferences: UserPreferencesService,
): Promise<void> {
  const ownerId = /^language:(\d{17,20})$/.exec(interaction.customId)?.[1];

  if (!ownerId) {
    await interaction.reply({
      content: invalidComponentMessage,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (ownerId !== interaction.user.id) {
    await interaction.reply({
      content: unauthorizedComponentMessage,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [selectedLocale] = interaction.values;

  if (!isUserLocale(selectedLocale)) {
    await interaction.reply({
      content: invalidSelectionMessage,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();
  await preferences.changeLocale(interaction.user.id, selectedLocale);
  await interaction.editReply({
    content: languageSavedMessages[selectedLocale],
    components: [],
  });
}
