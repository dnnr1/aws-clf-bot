import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
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
import type { GuildChannelSettingsService } from "../../application/discord/guild-channel-settings-service.js";
import { PracticeError } from "../../application/study/practice-error.js";
import type { PresentedQuestion } from "../../application/study/practice-repository.js";
import type { PracticeService } from "../../application/study/practice-service.js";
import { formatServiceMentions } from "./service-mentions.js";
export { formatServiceMentions } from "./service-mentions.js";
import type { StatisticsService } from "../../application/study/statistics-service.js";
import type {
  AnswerFeedback,
  CompletedExamResult,
} from "../../domain/study/question.js";
import type { StudyStatistics } from "../../domain/study/study-statistics.js";
import type { StudyQuestion } from "../../domain/study/question.js";

const helpMessages: Record<UserLocale, string> = {
  en: [
    "**Available commands**",
    "`/help` - Show this command list.",
    "`/language` - Choose English or Portuguese (Brazil).",
    "`/exam` - Start a timed 65-question exam (90 minutes).",
    "`/stats` - Show your study statistics.",
    "`/set-practice-channel` - Set the practice channel (server admins).",
    "`/set-tips-channel` - Set the daily tips channel (server admins).",
  ].join("\n"),
  "pt-BR": [
    "**Comandos disponíveis**",
    "`/help` - Exibe esta lista de comandos.",
    "`/language` - Escolha English ou Português (Brasil).",
    "`/exam` - Inicie uma simulação de 65 questões com duração de 90 minutos.",
    "`/stats` - Exiba suas estatísticas de estudo.",
    "`/set-practice-channel` - Defina o canal de prática (administradores).",
    "`/set-tips-channel` - Defina o canal de dicas (administradores).",
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
  "This study control is invalid. Use the practice panel to start again. / Este controle de estudo é inválido. Use o painel de prática para recomeçar.";
const successColor = 0x2ecc71;
const errorColor = 0xe74c3c;
const infoColor = 0x3498db;

const practiceMessages: Record<
  UserLocale,
  {
    answerCorrect: string;
    answerIncorrect: string;
    nextQuestion: string;
    restartPractice: string;
    correctCount: string;
    incorrectCount: string;
    explanation: string;
    noQuestions: string;
    sessionComplete: string;
    examNotAvailable: string;
    examExpired: string;
  }
> = {
  en: {
    answerCorrect: "Correct.",
    answerIncorrect: "Not quite.",
    nextQuestion: "Next question",
    restartPractice: "Restart practice",
    correctCount: "Correct",
    incorrectCount: "Incorrect",
    explanation: "Explanation",
    noQuestions:
      "No study questions are available yet. Please try again later.",
    sessionComplete: "This study session is complete.",
    examNotAvailable:
      "The exam requires 65 active questions with the required domain distribution. The question bank is still being populated; please try again later.",
    examExpired: "The 90-minute exam time limit has expired.",
  },
  "pt-BR": {
    answerCorrect: "Correto.",
    answerIncorrect: "Não foi dessa vez.",
    nextQuestion: "Próxima pergunta",
    restartPractice: "Recomeçar prática",
    correctCount: "Corretas",
    incorrectCount: "Erradas",
    explanation: "Explicação",
    noQuestions:
      "Ainda não há questões de estudo disponíveis. Tente novamente mais tarde.",
    sessionComplete: "Esta sessão de estudos foi concluída.",
    examNotAvailable:
      "O exame exige 65 questões ativas com a distribuição necessária entre os domínios. O banco de questões ainda está sendo preenchido; tente novamente mais tarde.",
    examExpired: "O limite de 90 minutos do exame expirou.",
  },
};

interface DiscordServices {
  preferences: UserPreferencesService;
  channelSettings: GuildChannelSettingsService;
  practice: PracticeService;
  statistics: StatisticsService;
  maintainPracticePanel: (
    guildId: string,
    channelId: string,
    discordUserId?: string,
  ) => Promise<void>;
  publishImmediateTip: (guildId: string, channelId: string) => Promise<boolean>;
}

export async function handleDiscordInteraction(
  interaction: Interaction,
  services: DiscordServices,
): Promise<void> {
  if (
    interaction.isChatInputCommand() &&
    (interaction.commandName === "set-practice-channel" ||
      interaction.commandName === "set-tips-channel")
  ) {
    await handleSetChannelCommand(interaction, services);
    return;
  }

  const isPracticeInteraction =
    interaction.isChatInputCommand() ||
    interaction.isButton() ||
    (interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("language:"));

  if (isPracticeInteraction) {
    const practiceChannelId = await getPracticeChannelId(interaction, services);

    if (practiceChannelId !== interaction.channelId) {
      const locale = await services.preferences.getLocale(interaction.user.id);
      await interaction.reply({
        embeds: [
          createStatusEmbed(
            practiceChannelId
              ? locale === "en"
                ? "Use the practice channel"
                : "Use o canal de prática"
              : locale === "en"
                ? "Practice channel not configured"
                : "Canal de prática não configurado",
            practiceChannelId
              ? locale === "en"
                ? `Study commands are available only in <#${practiceChannelId}>.`
                : `Os comandos de estudo só estão disponíveis em <#${practiceChannelId}>.`
              : locale === "en"
                ? "A server administrator must configure a practice channel with `/set-practice-channel`."
                : "Um administrador do servidor precisa configurar o canal com `/set-practice-channel`.",
            errorColor,
          ),
        ],
      });
      return;
    }
  }

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "help") {
      await handleHelpCommand(interaction, services.preferences);
    } else if (interaction.commandName === "language") {
      await handleLanguageCommand(interaction, services.preferences);
    } else if (interaction.commandName === "exam") {
      await handleExamCommand(interaction, services);
    } else if (interaction.commandName === "stats") {
      await handleStatsCommand(interaction, services);
    }

    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId === "start-practice") {
      await startPracticeSession(interaction, services);
    } else if (interaction.customId.startsWith("a:")) {
      await handleAnswerButton(interaction, services);
    } else if (interaction.customId.startsWith("n:")) {
      await handleNextButton(interaction, services);
    } else if (interaction.customId.startsWith("r:")) {
      await handleRestartButton(interaction, services);
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

async function startPracticeSession(
  interaction: ButtonInteraction,
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
        session,
      ),
    );
  } catch (error) {
    if (
      error instanceof PracticeError &&
      error.code === "no_questions_available"
    ) {
      await interaction.editReply({
        embeds: [
          createStatusEmbed(
            locale === "en"
              ? "No questions available"
              : "Sem questões disponíveis",
            practiceMessages[locale].noQuestions,
            errorColor,
          ),
        ],
      });
      return;
    }

    throw error;
  }
}

async function getPracticeChannelId(
  interaction: Interaction,
  services: DiscordServices,
): Promise<string | null> {
  if (!interaction.guildId) {
    return null;
  }

  const settings = await services.channelSettings.getSettings(
    interaction.guildId,
  );
  return settings.practiceChannelId;
}

async function handleSetChannelCommand(
  interaction: ChatInputCommandInteraction,
  services: DiscordServices,
): Promise<void> {
  const guildId = interaction.guildId;
  const isAdministrator =
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ??
    false;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const locale = await services.preferences.getLocale(interaction.user.id);

  if (!guildId || !isAdministrator) {
    await interaction.editReply({
      embeds: [
        createStatusEmbed(
          locale === "en" ? "Administrator only" : "Somente administradores",
          locale === "en"
            ? "Only a server administrator can configure bot channels."
            : "Somente um administrador do servidor pode configurar os canais do bot.",
          errorColor,
        ),
      ],
    });
    return;
  }

  const channel = interaction.options.getChannel("channel", true);

  if (
    !("guildId" in channel) ||
    channel.type !== ChannelType.GuildText ||
    channel.guildId !== guildId
  ) {
    await interaction.editReply({
      embeds: [
        createStatusEmbed(
          locale === "en" ? "Invalid channel" : "Canal inválido",
          locale === "en"
            ? "Choose a text channel from this server."
            : "Escolha um canal de texto deste servidor.",
          errorColor,
        ),
      ],
    });
    return;
  }

  let tipPublished: boolean | null = null;

  if (interaction.commandName === "set-practice-channel") {
    await services.channelSettings.setPracticeChannel(guildId, channel.id);
    await services.maintainPracticePanel(guildId, channel.id, interaction.user.id);
  } else {
    const currentSettings = await services.channelSettings.getSettings(guildId);
    await services.channelSettings.setTipsChannel(guildId, channel.id);
    if (currentSettings.tipsChannelId !== channel.id) {
      tipPublished = await services.publishImmediateTip(guildId, channel.id);
    }
  }

  const channelDescription =
    locale === "en"
      ? `${interaction.commandName === "set-practice-channel" ? "Practice" : "Daily tips"} channel is now <#${channel.id}>.`
      : `O canal de ${interaction.commandName === "set-practice-channel" ? "prática" : "dicas diárias"} agora é <#${channel.id}>.`;
  const tipLimitMessage =
    tipPublished === false
      ? locale === "en"
        ? "\nToday's three-tip limit has already been reached."
        : "\nO limite de três dicas de hoje já foi atingido."
      : "";

  await interaction.editReply({
    embeds: [
      createStatusEmbed(
        locale === "en" ? "Channel updated" : "Canal atualizado",
        `${channelDescription}${tipLimitMessage}`,
        successColor,
      ),
    ],
  });
}

async function handleStatsCommand(
  interaction: ChatInputCommandInteraction,
  services: DiscordServices,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const locale = await services.preferences.getLocale(interaction.user.id);
  const statistics = await services.statistics.getStudyStatistics(
    interaction.user.id,
  );

  await interaction.editReply({
    embeds: [
      createStatusEmbed(
        locale === "en" ? "Study statistics" : "Estatísticas de estudo",
        renderStudyStatistics(statistics, locale),
        infoColor,
      ),
    ],
  });
}

async function handleHelpCommand(
  interaction: ChatInputCommandInteraction,
  preferences: UserPreferencesService,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const locale = await preferences.getLocale(interaction.user.id);
  await interaction.editReply(helpMessages[locale]);
}

function renderStudyStatistics(
  statistics: StudyStatistics,
  locale: UserLocale,
): string {
  const accuracy = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(statistics.accuracyPercentage / 100);

  if (locale === "en") {
    return [
      `Questions answered: ${statistics.totalAnswers}`,
      `Correct: ${statistics.correctAnswers}`,
      `Incorrect: ${statistics.incorrectAnswers}`,
      `Accuracy: ${accuracy}`,
      `Study sessions: ${statistics.totalSessions}`,
      `Completed exams: ${statistics.completedExams}`,
      `Best exam: ${formatBestExam(statistics, locale)}`,
      `Current streak: ${statistics.currentStreakDays} day${statistics.currentStreakDays === 1 ? "" : "s"}`,
      `Longest streak: ${statistics.longestStreakDays} day${statistics.longestStreakDays === 1 ? "" : "s"}`,
    ].join("\n");
  }

  return [
    `Questões respondidas: ${statistics.totalAnswers}`,
    `Corretas: ${statistics.correctAnswers}`,
    `Incorretas: ${statistics.incorrectAnswers}`,
    `Precisão: ${accuracy}`,
    `Sessões de estudo: ${statistics.totalSessions}`,
    `Exames concluídos: ${statistics.completedExams}`,
    `Melhor resultado: ${formatBestExam(statistics, locale)}`,
    `Sequência atual: ${statistics.currentStreakDays} dia${statistics.currentStreakDays === 1 ? "" : "s"}`,
    `Maior sequência: ${statistics.longestStreakDays} dia${statistics.longestStreakDays === 1 ? "" : "s"}`,
  ].join("\n");
}

function formatBestExam(
  statistics: StudyStatistics,
  locale: UserLocale,
): string {
  if (
    statistics.bestExamCorrectCount === null ||
    statistics.bestExamAccuracyPercentage === null
  ) {
    return locale === "en" ? "No completed exams" : "Nenhum exame concluído";
  }

  const accuracy = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(statistics.bestExamAccuracyPercentage / 100);

  return `${statistics.bestExamCorrectCount}/65 (${accuracy})`;
}

function renderExamResult(
  result: CompletedExamResult,
  locale: UserLocale,
  lastAnswerStatus: string,
  lastAnswer: AnswerFeedback,
): EmbedBuilder {
  const accuracy = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(result.accuracyPercentage / 100);
  const durationMinutes = Math.floor(result.durationSeconds / 60);
  const durationSeconds = result.durationSeconds % 60;
  const domainResults = result.domainResults
    .map((domain) => {
      const domainAccuracy = new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(domain.correctCount / domain.questionCount);

      return `${domain.domainName[locale]}: ${domain.correctCount}/${domain.questionCount} (${domainAccuracy})`;
    })
    .join("\n");
  const description =
    locale === "en"
      ? `${renderAnswerCounts(lastAnswer, locale)}\n\n${lastAnswerStatus} Last answer: ${lastAnswer.correctOptionKey}. ${formatServiceMentions(lastAnswer.correctOptionText.en, lastAnswer.services)}\n\n${formatServiceMentions(lastAnswer.explanation.en, lastAnswer.services)}`
      : `${renderAnswerCounts(lastAnswer, locale)}\n\n${lastAnswerStatus} Última resposta: ${lastAnswer.correctOptionKey}. ${formatServiceMentions(lastAnswer.correctOptionText["pt-BR"], lastAnswer.services)}\n\n${formatServiceMentions(lastAnswer.explanation["pt-BR"], lastAnswer.services)}`;

  return new EmbedBuilder()
    .setColor(successColor)
    .setTitle(locale === "en" ? "Exam completed" : "Exame concluído")
    .setDescription(description)
    .addFields(
      {
        name: locale === "en" ? "Result" : "Resultado",
        value: `${result.correctCount}/${result.questionCount} (${accuracy})`,
        inline: true,
      },
      {
        name: locale === "en" ? "Duration" : "Duração",
        value: `${durationMinutes}m ${durationSeconds}s`,
        inline: true,
      },
      {
        name: locale === "en" ? "By exam domain" : "Por domínio da prova",
        value: domainResults,
      },
    );
}

function createStatusEmbed(
  title: string,
  description: string,
  color: number,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description);
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
      embeds: [
        createStatusEmbed(
          "Menu inválido / Invalid menu",
          invalidComponentMessage,
          errorColor,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (ownerId !== interaction.user.id) {
    await interaction.reply({
      embeds: [
        createStatusEmbed(
          "Menu não autorizado / Unauthorized menu",
          unauthorizedComponentMessage,
          errorColor,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [selectedLocale] = interaction.values;

  if (!isUserLocale(selectedLocale)) {
    await interaction.reply({
      embeds: [
        createStatusEmbed(
          "Idioma inválido / Invalid language",
          invalidSelectionMessage,
          errorColor,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();
  await preferences.changeLocale(interaction.user.id, selectedLocale);
  await interaction.editReply({
    embeds: [
      createStatusEmbed(
        selectedLocale === "en" ? "Language updated" : "Idioma atualizado",
        languageSavedMessages[selectedLocale],
        successColor,
      ),
    ],
    components: [],
  });
}

async function handleExamCommand(
  interaction: ChatInputCommandInteraction,
  services: DiscordServices,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const locale = await services.preferences.getLocale(interaction.user.id);

  try {
    const exam = await services.practice.startExam(interaction.user.id);
    await interaction.editReply(
      renderQuestion(
        exam.sessionId,
        interaction.user.id,
        exam.question,
        locale,
        exam,
      ),
    );
  } catch (error) {
    if (error instanceof PracticeError && error.code === "exam_not_available") {
      await interaction.editReply({
        embeds: [
          createStatusEmbed(
            locale === "en" ? "Exam unavailable" : "Exame indisponível",
            practiceMessages[locale].examNotAvailable,
            errorColor,
          ),
        ],
      });
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
      embeds: [
        createStatusEmbed(
          "Controle inválido / Invalid control",
          invalidPracticeComponentMessage,
          errorColor,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [, sessionId, presentationId, ownerId, optionKey] = match;

  if (!sessionId || !presentationId || !ownerId || !optionKey) {
    await interaction.reply({
      embeds: [
        createStatusEmbed(
          "Controle inválido / Invalid control",
          invalidPracticeComponentMessage,
          errorColor,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (ownerId !== interaction.user.id) {
    await interaction.deferUpdate();
    const locale = await services.preferences.getLocale(interaction.user.id);

    try {
      const session = await services.practice.start(interaction.user.id);
      await interaction.editReply(
        renderQuestion(
          session.sessionId,
          interaction.user.id,
          session.question,
          locale,
          session,
        ),
      );
    } catch (error) {
      if (
        error instanceof PracticeError &&
        error.code === "no_questions_available"
      ) {
        await interaction.editReply({
          embeds: [
            createStatusEmbed(
              locale === "en"
                ? "No questions available"
                : "Sem questões disponíveis",
              practiceMessages[locale].noQuestions,
              errorColor,
            ),
          ],
          components: [],
        });
        return;
      }

      throw error;
    }
    return;
  }

  await interaction.deferUpdate();
  const locale = await services.preferences.getLocale(interaction.user.id);

  try {
    const answer = await services.practice.answer(
      interaction.user.id,
      sessionId,
      presentationId,
      optionKey,
    );
    const messages = practiceMessages[locale];
    const status = answer.isCorrect
      ? messages.answerCorrect
      : messages.answerIncorrect;

    if (answer.examResult) {
      await interaction.editReply({
        embeds: [renderExamResult(answer.examResult, locale, status, answer)],
        components: [],
      });
    } else {
      await interaction.editReply({
        embeds: [
          createStatusEmbed(
            status,
            `${renderAnswerCounts(answer, locale)}\n\n${answer.correctOptionKey}. ${formatServiceMentions(answer.correctOptionText[locale], answer.services)}\n\n${messages.explanation}: ${formatServiceMentions(answer.explanation[locale], answer.services)}`,
            answer.isCorrect ? successColor : errorColor,
          ),
        ],
        components:
          answer.mode === "practice"
            ? [renderPracticeActions(sessionId, interaction.user.id, locale)]
            : [renderNextButton(sessionId, interaction.user.id, locale)],
      });
    }
  } catch (error) {
    if (error instanceof PracticeError) {
      await interaction.editReply({
        embeds: [
          createStatusEmbed(
            locale === "en" ? "Practice error" : "Erro na prática",
            getPracticeErrorMessage(error, locale),
            errorColor,
          ),
        ],
        components: [],
      });
      return;
    }

    throw error;
  }
}

async function handleRestartButton(
  interaction: ButtonInteraction,
  services: DiscordServices,
): Promise<void> {
  const match =
    /^r:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(\d{17,20})$/i.exec(
      interaction.customId,
    );

  if (!match) {
    await interaction.reply({
      embeds: [
        createStatusEmbed(
          "Controle inválido / Invalid control",
          invalidPracticeComponentMessage,
          errorColor,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [, sessionId, ownerId] = match;

  if (!sessionId || !ownerId || ownerId !== interaction.user.id) {
    await interaction.reply({
      embeds: [
        createStatusEmbed(
          "Controle inválido / Invalid control",
          invalidPracticeComponentMessage,
          errorColor,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();
  const locale = await services.preferences.getLocale(interaction.user.id);

  try {
    const session = await services.practice.restart(
      interaction.user.id,
      sessionId,
    );
    await interaction.editReply(
      renderQuestion(
        session.sessionId,
        interaction.user.id,
        session.question,
        locale,
        session,
      ),
    );
  } catch (error) {
    if (error instanceof PracticeError) {
      await interaction.editReply({
        embeds: [
          createStatusEmbed(
            locale === "en" ? "Practice error" : "Erro na prática",
            getPracticeErrorMessage(error, locale),
            errorColor,
          ),
        ],
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
      embeds: [
        createStatusEmbed(
          "Controle inválido / Invalid control",
          invalidPracticeComponentMessage,
          errorColor,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [, sessionId, ownerId] = match;

  if (!sessionId || !ownerId || ownerId !== interaction.user.id) {
    await interaction.reply({
      embeds: [
        createStatusEmbed(
          "Controle inválido / Invalid control",
          invalidPracticeComponentMessage,
          errorColor,
        ),
      ],
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
        embeds: [
          createStatusEmbed(
            locale === "en" ? "Practice complete" : "Prática concluída",
            practiceMessages[locale].sessionComplete,
            successColor,
          ),
        ],
        components: [],
      });
      return;
    }

    await interaction.editReply(
      renderQuestion(
        sessionId,
        interaction.user.id,
        question.question,
        locale,
        question,
      ),
    );
  } catch (error) {
    if (error instanceof PracticeError) {
      await interaction.editReply({
        embeds: [
          createStatusEmbed(
            locale === "en" ? "Practice error" : "Erro na prática",
            getPracticeErrorMessage(error, locale),
            errorColor,
          ),
        ],
        components: [],
      });
      return;
    }

    throw error;
  }
}

export function renderQuestion(
  sessionId: string,
  discordUserId: string,
  question: StudyQuestion,
  locale: UserLocale,
  progress: Pick<
    PresentedQuestion,
    "presentationId" | "correctCount" | "incorrectCount"
  > &
    Partial<
      Pick<
        PresentedQuestion,
        "mode" | "position" | "totalQuestions" | "expiresAt"
      >
    >,
) {
  const options = question.options
    .map((option) => `**${option.key}.** ${option.text[locale]}`)
    .join("\n");
  const buttons = question.options.map((option) =>
    new ButtonBuilder()
      .setCustomId(
        `a:${sessionId}:${progress.presentationId}:${discordUserId}:${option.key}`,
      )
      .setLabel(option.key)
      .setStyle(ButtonStyle.Primary),
  );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

  const progressMessage =
    progress?.mode === "exam_simulation" &&
    progress.totalQuestions !== null &&
    progress.expiresAt
      ? locale === "en"
        ? `**Exam question ${progress.position} of ${progress.totalQuestions} · ${Math.max(0, Math.ceil((progress.expiresAt.getTime() - Date.now()) / 60_000))} minutes remaining**\n\n`
        : `**Questão ${progress.position} de ${progress.totalQuestions} · ${Math.max(0, Math.ceil((progress.expiresAt.getTime() - Date.now()) / 60_000))} minutos restantes**\n\n`
      : "";

  return {
    content: `${renderAnswerCounts(progress, locale)}\n\n${progressMessage}${formatServiceMentions(question.prompt[locale], question.services)}\n\n${options}\n\u200B\n\u200B`,
    embeds: [],
    components: [row],
  };
}

function renderAnswerCounts(
  counts: Pick<PresentedQuestion, "correctCount" | "incorrectCount">,
  locale: UserLocale,
): string {
  const labels = practiceMessages[locale];
  return `**${labels.correctCount}:** ${counts.correctCount} · **${labels.incorrectCount}:** ${counts.incorrectCount}`;
}

function renderNextButton(
  sessionId: string,
  discordUserId: string,
  locale: UserLocale,
) {
  const button = new ButtonBuilder()
    .setCustomId(`n:${sessionId}:${discordUserId}`)
    .setLabel(practiceMessages[locale].nextQuestion)
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

function renderPracticeActions(
  sessionId: string,
  discordUserId: string,
  locale: UserLocale,
) {
  const nextButton = new ButtonBuilder()
    .setCustomId(`n:${sessionId}:${discordUserId}`)
    .setLabel(practiceMessages[locale].nextQuestion)
    .setStyle(ButtonStyle.Secondary);
  const restartButton = new ButtonBuilder()
    .setCustomId(`r:${sessionId}:${discordUserId}`)
    .setLabel(practiceMessages[locale].restartPractice)
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    nextButton,
    restartButton,
  );
}

function getPracticeErrorMessage(
  error: PracticeError,
  locale: UserLocale,
): string {
  if (error.code === "exam_expired") {
    return practiceMessages[locale].examExpired;
  }

  if (error.code === "exam_not_available") {
    return practiceMessages[locale].examNotAvailable;
  }

  if (error.code === "already_answered") {
    return locale === "en"
      ? "This question has already been answered."
      : "Esta questão já foi respondida.";
  }

  return locale === "en"
    ? "This study session is no longer available. Select an option in the practice channel to start a new one."
    : "Esta sessão de estudos não está mais disponível. Selecione uma opção no canal de prática para iniciar outra.";
}
