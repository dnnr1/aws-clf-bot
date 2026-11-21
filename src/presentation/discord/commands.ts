import {
  ChannelType,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show the available bot commands."),
  new SlashCommandBuilder()
    .setName("language")
    .setDescription("Choose the language used by the bot."),
  new SlashCommandBuilder()
    .setName("practice")
    .setDescription("Start a practice session with AWS study questions."),
  new SlashCommandBuilder()
    .setName("exam")
    .setDescription("Start a 65-question AWS exam simulation."),
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show your study statistics."),
  new SlashCommandBuilder()
    .setName("set-practice-channel")
    .setDescription("Set the server's study practice channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The text channel used for private study commands.")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("set-tips-channel")
    .setDescription("Set the server's daily learning tips channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The text channel used for daily learning tips.")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    ),
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
