import { readFile } from "node:fs/promises";
import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  type InteractionReplyOptions,
} from "discord.js";
import { PracticeService } from "./application/study/practice-service.js";
import { StatisticsService } from "./application/study/statistics-service.js";
import { DrizzleBotChannelMessageRepository } from "./infrastructure/database/bot-channel-message-repository.js";
import { UserPreferencesService } from "./application/users/user-preferences-service.js";
import { parseEnvironment } from "./infrastructure/config/environment.js";
import { createDatabase } from "./infrastructure/database/client.js";
import { DrizzleDailyTipPublicationRepository } from "./infrastructure/database/daily-tip-publication-repository.js";
import { DrizzlePracticeRepository } from "./infrastructure/database/practice-repository.js";
import { DrizzleStatisticsRepository } from "./infrastructure/database/statistics-repository.js";
import { DrizzleUserPreferencesRepository } from "./infrastructure/database/user-preferences-repository.js";
import { logger } from "./infrastructure/logging/logger.js";
import { startDailyTipScheduler } from "./infrastructure/discord/daily-tip-scheduler.js";
import { parseDailyTipBank } from "./infrastructure/questions/daily-tip-schema.js";
import { handleDiscordInteraction } from "./presentation/discord/interaction-handler.js";
import { registerSlashCommands } from "./presentation/discord/commands.js";
import { maintainPracticeChannelPanel } from "./presentation/discord/practice-channel-panel.js";

async function startBot(): Promise<void> {
  const environment = parseEnvironment(process.env);
  const tipBankContents = await readFile(
    new URL("../data/tips/clf-c02.json", import.meta.url),
    "utf8",
  );
  const tips = parseDailyTipBank(JSON.parse(tipBankContents));
  const { database, pool } = createDatabase(environment.DATABASE_URL);
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const preferences = new UserPreferencesService(
    new DrizzleUserPreferencesRepository(database),
  );
  const practice = new PracticeService(new DrizzlePracticeRepository(database));
  const statistics = new StatisticsService(
    new DrizzleStatisticsRepository(database),
  );
  const services = {
    preferences,
    practice,
    statistics,
    practiceChannelId: environment.DISCORD_PRACTICE_CHANNEL_ID,
  };
  let stopDailyTipScheduler: (() => void) | undefined;
  let shutdownPromise: Promise<void> | undefined;

  const shutdown = (signal: string): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      logger.info("application.shutting_down", { signal });
      stopDailyTipScheduler?.();
      client.destroy();

      try {
        await pool.end();
      } catch (error) {
        logger.error("database.shutdown_failed", error);
        process.exitCode = 1;
      }
    })();

    return shutdownPromise;
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  pool.on("error", (error) => logger.error("database.pool_error", error));
  client.on(Events.Error, (error) =>
    logger.error("discord.client_error", error),
  );
  client.on(Events.InteractionCreate, (interaction) => {
    void handleDiscordInteraction(interaction, services).catch(
      async (error: unknown) => {
        logger.error("discord.interaction_failed", error, {
          interactionId: interaction.id,
        });
        await replyToFailedInteraction(interaction);
      },
    );
  });

  try {
    await pool.query("select 1");
    await client.login(environment.DISCORD_TOKEN);

    const applicationId = client.user?.id;

    if (!applicationId) {
      throw new Error("Discord client connected without an application user.");
    }

    await registerSlashCommands(
      environment.DISCORD_TOKEN,
      applicationId,
      environment.DISCORD_GUILD_ID,
    );
    await maintainPracticeChannelPanel(
      client,
      environment.DISCORD_PRACTICE_CHANNEL_ID,
      new DrizzleBotChannelMessageRepository(database),
    );
    stopDailyTipScheduler = startDailyTipScheduler(
      client,
      environment.DISCORD_TIPS_CHANNEL_ID,
      tips,
      new DrizzleDailyTipPublicationRepository(database),
      logger,
    );
    logger.info("discord.bot_ready");
  } catch (error) {
    await shutdown("startup_failure");
    throw error;
  }
}

async function replyToFailedInteraction(
  interaction: Parameters<typeof handleDiscordInteraction>[0],
): Promise<void> {
  if (!interaction.isRepliable()) {
    return;
  }

  const response = {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("Erro / Error")
        .setDescription(
          "Ocorreu um erro inesperado. Tente novamente. / An unexpected error occurred. Please try again.",
        ),
    ],
    flags: MessageFlags.Ephemeral,
  } satisfies InteractionReplyOptions;

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
  } catch (error) {
    logger.error("discord.interaction_error_response_failed", error, {
      interactionId: interaction.id,
    });
  }
}

void startBot().catch((error: unknown) => {
  logger.error("application.start_failed", error);
  process.exitCode = 1;
});
