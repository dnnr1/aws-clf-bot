import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type Interaction,
} from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatServiceMentions,
  handleDiscordInteraction,
} from "../../../src/presentation/discord/interaction-handler.js";
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

describe("practice panel interaction", () => {
  it("starts a private session with initial counts and highlighted services", async () => {
    const userId = "12345678901234569";
    const sessionId = "22345678-9012-3456-7890-123456789012";
    const questionId = "32345678-9012-3456-7890-123456789012";
    const start = vi.fn().mockResolvedValue({
      sessionId,
      correctCount: 0,
      incorrectCount: 0,
      question: {
        id: questionId,
        domainId: "cloud-technology-services",
        prompt: {
          en: "Which service stores objects in Amazon S3?",
          "pt-BR": "Qual serviço armazena objetos no Amazon S3?",
        },
        options: [
          {
            key: "A",
            text: {
              en: "AWS Identity and Access Management (IAM)",
              "pt-BR": "AWS Identity and Access Management (IAM)",
            },
          },
          {
            key: "B",
            text: { en: "Amazon EC2", "pt-BR": "Amazon EC2" },
          },
          {
            key: "C",
            text: { en: "AWS Lambda", "pt-BR": "AWS Lambda" },
          },
          {
            key: "D",
            text: { en: "Amazon RDS", "pt-BR": "Amazon RDS" },
          },
        ],
        services: ["Amazon S3", "AWS Identity and Access Management (IAM)"],
      },
    });
    const interaction = {
      isChatInputCommand: () => false,
      isButton: () => true,
      isStringSelectMenu: () => false,
      customId: "start-practice",
      channelId,
      guildId,
      user: { id: userId },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    };
    channelSettings.getSettings.mockResolvedValue({
      practiceChannelId: channelId,
      tipsChannelId: null,
    });

    await handleDiscordInteraction(interaction as unknown as Interaction, {
      ...services,
      practice: {
        start,
      } as unknown as Parameters<
        typeof handleDiscordInteraction
      >[1]["practice"],
    });

    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    });
    expect(start).toHaveBeenCalledWith(userId);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("**Corretas:** 0 · **Erradas:** 0"),
      }),
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("`Amazon S3`"),
      }),
    );
  });
});

describe("formatServiceMentions", () => {
  it("highlights full service names and aliases without nesting existing code", () => {
    expect(
      formatServiceMentions(
        "Amazon S3 and IAM support. `Amazon S3` is object storage.",
        ["Amazon S3", "AWS Identity and Access Management (IAM)"],
      ),
    ).toBe("`Amazon S3` and `IAM` support. `Amazon S3` is object storage.");
  });
});
