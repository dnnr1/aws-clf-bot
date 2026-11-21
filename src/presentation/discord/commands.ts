import { REST, Routes, SlashCommandBuilder } from "discord.js";

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show the available bot commands."),
  new SlashCommandBuilder()
    .setName("language")
    .setDescription("Choose the language used by the bot."),
] as const;

export async function registerSlashCommands(
  token: string,
  applicationId: string,
  guildId?: string,
): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(applicationId, guildId)
    : Routes.applicationCommands(applicationId);

  await rest.put(route, {
    body: commandDefinitions.map((command) => command.toJSON()),
  });
}
