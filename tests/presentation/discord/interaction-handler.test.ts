import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type Interaction,
} from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleDiscordInteraction } from "../../../src/presentation/discord/interaction-handler.js";
import { commandDefinitions } from "../../../src/presentation/discord/commands.js";

const guildId = "12345678901234567";
const channelId = "12345678901234568";
const channelSettings = {
  getSettings: vi.fn(),
  setPracticeChannel: vi.fn().mockResolvedValue(undefined),
  setTipsChannel: vi.fn().mockResolvedValue(undefined),
};
const maintainPracticePanel = vi.fn().mockResolvedValue(undefined);
const services: Parameters<typeof handleDiscordInteraction>[1] = {
  preferences: {
    getLocale: vi.fn().mockResolvedValue("pt-BR"),
  } as unknown as Parameters<typeof handleDiscordInteraction>[1]["preferences"],
  channelSettings: channelSettings as unknown as Parameters<
    typeof handleDiscordInteraction
  >[1]["channelSettings"],
  practice: {} as Parameters<typeof handleDiscordInteraction>[1]["practice"],
  statistics: {} as Parameters<
    typeof handleDiscordInteraction
  >[1]["statistics"],
  maintainPracticePanel,
};

function createSetPracticeInteraction(
  isAdministrator: boolean,
  selectedGuildId = guildId,
  commandName:
    "set-practice-channel" | "set-tips-channel" = "set-practice-channel",
) {
  return {
    isChatInputCommand: () => true,
    commandName,
    user: { id: "12345678901234569" },
    guildId,
    memberPermissions: {
      has: vi.fn().mockReturnValue(isAdministrator),
    },
    options: {
      getChannel: vi.fn().mockReturnValue({
        id: channelId,
        guildId: selectedGuildId,
        type: ChannelType.GuildText,
      }),
    },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("channel configuration commands", () => {
  it("registers both channel commands for administrators only", () => {
    for (const commandName of ["set-practice-channel", "set-tips-channel"]) {
      const command = commandDefinitions.find(
        (definition) => definition.name === commandName,
      );

      expect(command?.toJSON().default_member_permissions).toBe(
        PermissionFlagsBits.Administrator.toString(),
      );
    }
  });

  it("rejects non-administrators without persisting channel settings", async () => {
    const interaction = createSetPracticeInteraction(false);

    await handleDiscordInteraction(
      interaction as unknown as Interaction,
      services,
    );

    expect(interaction.deferReply).toHaveBeenCalledWith(
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
    expect(interaction.editReply).toHaveBeenCalled();
    expect(channelSettings.setPracticeChannel).not.toHaveBeenCalled();
    expect(maintainPracticePanel).not.toHaveBeenCalled();
  });

  it("persists an administrator's channel and updates the practice panel", async () => {
    const interaction = createSetPracticeInteraction(true);

    await handleDiscordInteraction(
      interaction as unknown as Interaction,
      services,
    );

    expect(channelSettings.setPracticeChannel).toHaveBeenCalledWith(
      guildId,
      channelId,
    );
    expect(maintainPracticePanel).toHaveBeenCalledWith(guildId, channelId);
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("persists an administrator's tips channel without moving the practice panel", async () => {
    const interaction = createSetPracticeInteraction(
      true,
      guildId,
      "set-tips-channel",
    );

    await handleDiscordInteraction(
      interaction as unknown as Interaction,
      services,
    );

    expect(channelSettings.setTipsChannel).toHaveBeenCalledWith(
      guildId,
      channelId,
    );
    expect(channelSettings.setPracticeChannel).not.toHaveBeenCalled();
    expect(maintainPracticePanel).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("rejects a channel belonging to another server", async () => {
    const interaction = createSetPracticeInteraction(true, "22345678901234567");

    await handleDiscordInteraction(
      interaction as unknown as Interaction,
      services,
    );

    expect(interaction.deferReply).toHaveBeenCalledWith(
      expect.objectContaining({ flags: MessageFlags.Ephemeral }),
    );
    expect(interaction.editReply).toHaveBeenCalled();
    expect(channelSettings.setPracticeChannel).not.toHaveBeenCalled();
  });
});
