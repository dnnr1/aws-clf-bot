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
    "`/practice` - Start an AWS question practice session.",
    "`/exam` - Start a timed 65-question exam.",
    "`/stats` - Show your study statistics.",
    "`/set-practice-channel` - Set the practice channel (server admins).",
    "`/set-tips-channel` - Set the daily tips channel (server admins).",
  ].join("\n"),
  "pt-BR": [
    "**Comandos disponíveis**",
    "`/help` - Exibe esta lista de comandos.",
    "`/language` - Escolha English ou Português (Brasil).",
    "`/practice` - Inicie uma sessão de prática com questões da AWS.",
    "`/exam` - Inicie uma simulação de exame com 65 questões.",
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
  "This practice control is invalid. Run /practice again. / Este controle de prática é inválido. Use /practice novamente.";
const successColor = 0x2ecc71;
const errorColor = 0xe74c3c;
const infoColor = 0x3498db;

const practiceMessages: Record<
  UserLocale,
  {
    answerCorrect: string;
    answerIncorrect: string;
    nextQuestion: string;
    correctCount: string;
    incorrectCount: string;
    explanation: string;
    noQuestions: string;
    exhausted: string;
    examNotAvailable: string;
    examExpired: string;
  }
> = {
  en: {
    answerCorrect: "Correct.",
    answerIncorrect: "Not quite.",
    nextQuestion: "Next question",
    correctCount: "Correct",
    incorrectCount: "Incorrect",
    explanation: "Explanation",
    noQuestions:
      "No study questions are available yet. Please try again later.",
    exhausted:
      "You have answered every available question in this session. Run /practice to start another session.",
    examNotAvailable:
      "The exam requires 65 active questions with the required domain distribution. The question bank is still being populated; please try again later.",
    examExpired: "The 90-minute exam time limit has expired.",
  },
  "pt-BR": {
    answerCorrect: "Correto.",
    answerIncorrect: "Não foi dessa vez.",
    nextQuestion: "Próxima pergunta",
    correctCount: "Corretas",
    incorrectCount: "Erradas",
    explanation: "Explicação",
    noQuestions:
      "Ainda não há questões de estudo disponíveis. Tente novamente mais tarde.",
    exhausted:
      "Você respondeu a todas as questões disponíveis nesta sessão. Use /practice para iniciar outra sessão.",
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
  maintainPracticePanel: (guildId: string, channelId: string) => Promise<void>;
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
    } else if (interaction.commandName === "practice") {
      await handlePracticeCommand(interaction, services);
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

  if (interaction.commandName === "set-practice-channel") {
    await services.channelSettings.setPracticeChannel(guildId, channel.id);
    await services.maintainPracticePanel(guildId, channel.id);
  } else {
    await services.channelSettings.setTipsChannel(guildId, channel.id);
  }

  await interaction.editReply({
    embeds: [
      createStatusEmbed(
        locale === "en" ? "Channel updated" : "Canal atualizado",
        locale === "en"
          ? `${interaction.commandName === "set-practice-channel" ? "Practice" : "Daily tips"} channel is now <#${channel.id}>.`
          : `O canal de ${interaction.commandName === "set-practice-channel" ? "prática" : "dicas diárias"} agora é <#${channel.id}>.`,
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

async function handlePracticeCommand(
  interaction: ChatInputCommandInteraction,
  services: DiscordServices,
): Promise<void> {
  await startPracticeSession(interaction, services);
}

async function startPracticeSession(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
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

  const [, sessionId, questionId, ownerId, optionKey] = match;

  if (
    !sessionId ||
    !questionId ||
    !ownerId ||
    !optionKey ||
    ownerId !== interaction.user.id
  ) {
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
        components: [renderNextButton(sessionId, interaction.user.id, locale)],
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
            practiceMessages[locale].exhausted,
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

function renderQuestion(
  sessionId: string,
  discordUserId: string,
  question: StudyQuestion,
  locale: UserLocale,
  progress: Pick<PresentedQuestion, "correctCount" | "incorrectCount"> &
    Partial<
      Pick<
        PresentedQuestion,
        "mode" | "position" | "totalQuestions" | "expiresAt"
      >
    >,
) {
  const options = question.options
    .map(
      (option) =>
        `**${option.key}.** ${formatServiceMentions(option.text[locale], question.services)}`,
    )
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

  const progressMessage =
    progress?.mode === "exam_simulation" &&
    progress.totalQuestions !== null &&
    progress.expiresAt
      ? locale === "en"
        ? `**Exam question ${progress.position} of ${progress.totalQuestions} · ${Math.max(0, Math.ceil((progress.expiresAt.getTime() - Date.now()) / 60_000))} minutes remaining**\n\n`
        : `**Questão ${progress.position} de ${progress.totalQuestions} · ${Math.max(0, Math.ceil((progress.expiresAt.getTime() - Date.now()) / 60_000))} minutos restantes**\n\n`
      : "";

  return {
    content: `${renderAnswerCounts(progress, locale)}\n\n${progressMessage}${formatServiceMentions(question.prompt[locale], question.services)}\n\n${options}`,
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

export function formatServiceMentions(
  text: string,
  services: string[],
): string {
  const terms = new Set<string>();

  for (const service of services) {
    terms.add(service);

    const baseName = service.replace(/\s*\([^)]*\)/g, "");
    if (baseName !== service) {
      terms.add(baseName);
    }

    for (const [, acronym] of service.matchAll(/\(([^)]+)\)/g)) {
      if (acronym) {
        terms.add(acronym);
      }
    }

    const words = baseName.split(/\s+/);
    const lastWord = words.at(-1);
    const hasProductPrefix =
      words.length === 2 && /^(Amazon|AWS)$/i.test(words[0] ?? "");
    if (lastWord && (hasProductPrefix || /^[A-Z0-9.-]{2,8}$/.test(lastWord))) {
      terms.add(lastWord);
    }
  }

  const alternatives = [...terms]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegularExpression)
    .join("|");

  if (!alternatives) {
    return text;
  }

  const servicePattern = new RegExp(
    `(?<![\\w\`])(?:${alternatives})(?![\\w\`])`,
    "gi",
  );
  return text.replace(servicePattern, (match) => `\`${match}\``);
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    ? "This practice session is no longer available. Run /practice to start a new one."
    : "Esta sessão de prática não está mais disponível. Use /practice para iniciar outra.";
}
