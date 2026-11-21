import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
  type StringSelectMenuInteraction,
} from "discord.js";
import {
  isUserLocale,
  type UserLocale,
} from "../../domain/users/user-locale.js";
import type { UserPreferencesService } from "../../application/users/user-preferences-service.js";
import { PracticeError } from "../../application/study/practice-error.js";
import type { PracticeService } from "../../application/study/practice-service.js";
import type { StudyQuestion } from "../../domain/study/question.js";

const helpMessages: Record<UserLocale, string> = {
  en: [
    "**Available commands**",
    "`/help` - Show this command list.",
    "`/language` - Choose English or Portuguese (Brazil).",
    "`/practice` - Start an AWS question practice session.",
  ].join("\n"),
  "pt-BR": [
    "**Comandos disponíveis**",
    "`/help` - Exibe esta lista de comandos.",
    "`/language` - Escolha English ou Português (Brasil).",
    "`/practice` - Inicie uma sessão de prática com questões da AWS.",
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
const invalidPracticeComponentMessage =
  "This practice control is invalid. Run /practice again. / Este controle de prática é inválido. Use /practice novamente.";

const practiceMessages: Record<
  UserLocale,
  {
    answerCorrect: string;
    answerIncorrect: string;
    continue: string;
    explanation: string;
    noQuestions: string;
    exhausted: string;
  }
> = {
  en: {
    answerCorrect: "Correct.",
    answerIncorrect: "Not quite.",
    continue: "Continue practice",
    explanation: "Explanation",
    noQuestions:
      "No study questions are available yet. Please try again later.",
    exhausted:
      "You have answered every available question in this session. Run /practice to start another session.",
  },
  "pt-BR": {
    answerCorrect: "Correto.",
    answerIncorrect: "Não foi dessa vez.",
    continue: "Continuar prática",
    explanation: "Explicação",
    noQuestions:
      "Ainda não há questões de estudo disponíveis. Tente novamente mais tarde.",
    exhausted:
      "Você respondeu a todas as questões disponíveis nesta sessão. Use /practice para iniciar outra sessão.",
  },
};

interface DiscordServices {
  preferences: UserPreferencesService;
  practice: PracticeService;
}

export async function handleDiscordInteraction(
  interaction: Interaction,
  services: DiscordServices,
): Promise<void> {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "help") {
      await handleHelpCommand(interaction, services.preferences);
    } else if (interaction.commandName === "language") {
      await handleLanguageCommand(interaction, services.preferences);
    } else if (interaction.commandName === "practice") {
      await handlePracticeCommand(interaction, services);
    }

    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith("a:")) {
      await handleAnswerButton(interaction, services);
    } else if (interaction.customId.startsWith("n:")) {
      await handleNextButton(interaction, services);
    }

    return;
  }

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId.startsWith("language:")
  ) {
    await handleLanguageSelection(interaction, services.preferences);
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

async function handlePracticeCommand(
  interaction: ChatInputCommandInteraction,
  services: DiscordServices,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const locale = await services.preferences.getLocale(interaction.user.id);

  try {
    const session = await services.practice.start(interaction.user.id);
    await interaction.editReply(
      renderQuestion(
        session.sessionId,
        interaction.user.id,
        session.question,
        locale,
      ),
    );
  } catch (error) {
    if (
      error instanceof PracticeError &&
      error.code === "no_questions_available"
    ) {
      await interaction.editReply(practiceMessages[locale].noQuestions);
      return;
    }

    throw error;
  }
}

async function handleAnswerButton(
  interaction: ButtonInteraction,
  services: DiscordServices,
): Promise<void> {
  const match =
    /^a:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(\d{17,20}):([A-D])$/i.exec(
      interaction.customId,
    );

  if (!match) {
    await interaction.reply({
      content: invalidPracticeComponentMessage,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [, sessionId, questionId, ownerId, optionKey] = match;

  if (
    !sessionId ||
    !questionId ||
    !ownerId ||
    !optionKey ||
    ownerId !== interaction.user.id
  ) {
    await interaction.reply({
      content: invalidPracticeComponentMessage,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();
  const locale = await services.preferences.getLocale(interaction.user.id);

  try {
    const answer = await services.practice.answer(
      interaction.user.id,
      sessionId,
      questionId,
      optionKey,
    );
    const messages = practiceMessages[locale];
    const status = answer.isCorrect
      ? messages.answerCorrect
      : messages.answerIncorrect;

    await interaction.editReply({
      content: [
        `**${status}**`,
        `**${answer.correctOptionKey}. ${answer.correctOptionText[locale]}**`,
        `**${messages.explanation}:** ${answer.explanation[locale]}`,
      ].join("\n\n"),
      components: [renderNextButton(sessionId, interaction.user.id, locale)],
    });
  } catch (error) {
    if (error instanceof PracticeError) {
      await interaction.editReply({
        content: getPracticeErrorMessage(error, locale),
        components: [],
      });
      return;
    }

    throw error;
  }
}

async function handleNextButton(
  interaction: ButtonInteraction,
  services: DiscordServices,
): Promise<void> {
  const match =
    /^n:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(\d{17,20})$/i.exec(
      interaction.customId,
    );

  if (!match) {
    await interaction.reply({
      content: invalidPracticeComponentMessage,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [, sessionId, ownerId] = match;

  if (!sessionId || !ownerId || ownerId !== interaction.user.id) {
    await interaction.reply({
      content: invalidPracticeComponentMessage,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();
  const locale = await services.preferences.getLocale(interaction.user.id);

  try {
    const question = await services.practice.next(
      interaction.user.id,
      sessionId,
    );

    if (!question) {
      await interaction.editReply({
        content: practiceMessages[locale].exhausted,
        components: [],
      });
      return;
    }

    await interaction.editReply(
      renderQuestion(sessionId, interaction.user.id, question, locale),
    );
  } catch (error) {
    if (error instanceof PracticeError) {
      await interaction.editReply({
        content: getPracticeErrorMessage(error, locale),
        components: [],
      });
      return;
    }

    throw error;
  }
}

function renderQuestion(
  sessionId: string,
  discordUserId: string,
  question: StudyQuestion,
  locale: UserLocale,
) {
  const options = question.options
    .map((option) => `**${option.key}.** ${option.text[locale]}`)
    .join("\n");
  const buttons = question.options.map((option) =>
    new ButtonBuilder()
      .setCustomId(
        `a:${sessionId}:${question.id}:${discordUserId}:${option.key}`,
      )
      .setLabel(option.key)
      .setStyle(ButtonStyle.Primary),
  );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

  return {
    content: `${question.prompt[locale]}\n\n${options}`,
    components: [row],
  };
}

function renderNextButton(
  sessionId: string,
  discordUserId: string,
  locale: UserLocale,
) {
  const button = new ButtonBuilder()
    .setCustomId(`n:${sessionId}:${discordUserId}`)
    .setLabel(practiceMessages[locale].continue)
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

function getPracticeErrorMessage(
  error: PracticeError,
  locale: UserLocale,
): string {
  if (error.code === "already_answered") {
    return locale === "en"
      ? "This question has already been answered."
      : "Esta questão já foi respondida.";
  }

  return locale === "en"
    ? "This practice session is no longer available. Run /practice to start a new one."
    : "Esta sessão de prática não está mais disponível. Use /practice para iniciar outra.";
}
