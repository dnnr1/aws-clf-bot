import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  type InteractionReplyOptions,
} from "discord.js";
import { PracticeService } from "./application/study/practice-service.js";
import { UserPreferencesService } from "./application/users/user-preferences-service.js";
import { parseEnvironment } from "./infrastructure/config/environment.js";
import { createDatabase } from "./infrastructure/database/client.js";
import { DrizzlePracticeRepository } from "./infrastructure/database/practice-repository.js";
import { DrizzleUserPreferencesRepository } from "./infrastructure/database/user-preferences-repository.js";
import { logger } from "./infrastructure/logging/logger.js";
import { handleDiscordInteraction } from "./presentation/discord/interaction-handler.js";
import { registerSlashCommands } from "./presentation/discord/commands.js";

async function startBot(): Promise<void> {
  const environment = parseEnvironment(process.env);
  const { database, pool } = createDatabase(environment.DATABASE_URL);
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const preferences = new UserPreferencesService(
    new DrizzleUserPreferencesRepository(database),
  );
  const practice = new PracticeService(new DrizzlePracticeRepository(database));
  const services = { preferences, practice };
  let shutdownPromise: Promise<void> | undefined;

  const shutdown = (signal: string): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      logger.info("application.shutting_down", { signal });
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
    content:
      "An unexpected error occurred. Please try again. / Ocorreu um erro inesperado. Tente novamente.",
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
