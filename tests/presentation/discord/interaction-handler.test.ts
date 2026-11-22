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
const publishImmediateTip = vi.fn().mockResolvedValue(true);
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
  publishImmediateTip,
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

    expect(
      commandDefinitions.some((definition) => definition.name === "practice"),
    ).toBe(false);
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
    expect(maintainPracticePanel).toHaveBeenCalledWith(
      guildId,
      channelId,
      "12345678901234569",
    );
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it("persists an administrator's tips channel without moving the practice panel", async () => {
    channelSettings.getSettings.mockResolvedValue({
      practiceChannelId: null,
      tipsChannelId: null,
    });
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
    expect(publishImmediateTip).toHaveBeenCalledWith(guildId, channelId);
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

describe("leaderboard command", () => {
  it("registers and renders the persisted leaderboard", async () => {
    expect(
      commandDefinitions.some(
        (definition) => definition.name === "leaderboard",
      ),
    ).toBe(true);

    const getLeaderboard = vi.fn().mockResolvedValue([
      {
        discordUserId: "12345678901234569",
        totalAnswers: 20,
        correctAnswers: 18,
        accuracyPercentage: 90,
      },
    ]);
    const interaction = {
      isChatInputCommand: () => true,
      isButton: () => false,
      isStringSelectMenu: () => false,
      commandName: "leaderboard",
      channelId,
      guildId,
      user: { id: "12345678901234569" },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    };
    channelSettings.getSettings.mockResolvedValue({
      practiceChannelId: channelId,
      tipsChannelId: null,
    });

    await handleDiscordInteraction(interaction as unknown as Interaction, {
      ...services,
      statistics: {
        getLeaderboard,
      } as unknown as Parameters<
        typeof handleDiscordInteraction
      >[1]["statistics"],
    });

    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    });
    expect(getLeaderboard).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
      }),
    );
  });
});

describe("practice panel interaction", () => {
  it("starts a private practice session when the exercise button is clicked", async () => {
    const userId = "12345678901234569";
    const sessionId = "22345678-9012-3456-7890-123456789012";
    const start = vi.fn().mockResolvedValue({
      sessionId,
      presentationId: "42345678-9012-3456-7890-123456789012",
      correctCount: 0,
      incorrectCount: 0,
      question: {
        id: "32345678-9012-3456-7890-123456789012",
        domainId: "cloud-technology-services",
        prompt: {
          en: "Which service stores objects in Amazon S3?",
          "pt-BR": "Qual serviço armazena objetos no Amazon S3?",
        },
        options: [
          { key: "A", text: { en: "Amazon S3", "pt-BR": "Amazon S3" } },
          { key: "B", text: { en: "Amazon EC2", "pt-BR": "Amazon EC2" } },
          { key: "C", text: { en: "AWS Lambda", "pt-BR": "AWS Lambda" } },
          { key: "D", text: { en: "Amazon RDS", "pt-BR": "Amazon RDS" } },
        ],
        services: ["Amazon S3"],
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
      reply: vi.fn().mockResolvedValue(undefined),
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
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining(
          "Qual serviço armazena objetos no `Amazon S3`?",
        ),
        embeds: [],
      }),
    );
  });

  it("restarts a session and resets its private score", async () => {
    const userId = "12345678901234569";
    const oldSessionId = "22345678-9012-3456-7890-123456789012";
    const newSessionId = "52345678-9012-3456-7890-123456789012";
    const restart = vi.fn().mockResolvedValue({
      sessionId: newSessionId,
      presentationId: "62345678-9012-3456-7890-123456789012",
      correctCount: 0,
      incorrectCount: 0,
      question: {
        id: "32345678-9012-3456-7890-123456789012",
        domainId: "cloud-technology-services",
        prompt: {
          en: "Choose an AWS service.",
          "pt-BR": "Escolha um serviço da AWS.",
        },
        options: [
          { key: "A", text: { en: "S3", "pt-BR": "S3" } },
          { key: "B", text: { en: "EC2", "pt-BR": "EC2" } },
          { key: "C", text: { en: "Lambda", "pt-BR": "Lambda" } },
          { key: "D", text: { en: "RDS", "pt-BR": "RDS" } },
        ],
        services: [],
      },
    });
    const interaction = {
      isChatInputCommand: () => false,
      isButton: () => true,
      isStringSelectMenu: () => false,
      customId: `r:${oldSessionId}:${userId}`,
      channelId,
      guildId,
      user: { id: userId },
      deferUpdate: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    };
    channelSettings.getSettings.mockResolvedValue({
      practiceChannelId: channelId,
      tipsChannelId: null,
    });

    await handleDiscordInteraction(interaction as unknown as Interaction, {
      ...services,
      practice: {
        restart,
      } as unknown as Parameters<
        typeof handleDiscordInteraction
      >[1]["practice"],
    });

    expect(restart).toHaveBeenCalledWith(userId, oldSessionId);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("**Corretas:** 0 · **Erradas:** 0"),
      }),
    );
  });

  it("clears the previous answer feedback when displaying the next question", async () => {
    const userId = "12345678901234569";
    const sessionId = "22345678-9012-3456-7890-123456789012";
    const next = vi.fn().mockResolvedValue({
      presentationId: "42345678-9012-3456-7890-123456789012",
      question: {
        id: "32345678-9012-3456-7890-123456789012",
        domainId: "cloud-technology-services",
        prompt: {
          en: "Which service stores objects in Amazon S3?",
          "pt-BR": "Qual serviço armazena objetos no Amazon S3?",
        },
        options: [
          { key: "A", text: { en: "Amazon S3", "pt-BR": "Amazon S3" } },
          { key: "B", text: { en: "Amazon EC2", "pt-BR": "Amazon EC2" } },
          { key: "C", text: { en: "AWS Lambda", "pt-BR": "AWS Lambda" } },
          { key: "D", text: { en: "Amazon RDS", "pt-BR": "Amazon RDS" } },
        ],
        services: ["Amazon S3"],
      },
      mode: "practice",
      position: 2,
      totalQuestions: null,
      expiresAt: null,
      correctCount: 1,
      incorrectCount: 0,
    });
    const interaction = {
      isChatInputCommand: () => false,
      isButton: () => true,
      isStringSelectMenu: () => false,
      customId: `n:${sessionId}:${userId}`,
      channelId,
      guildId,
      user: { id: userId },
      deferUpdate: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    };
    channelSettings.getSettings.mockResolvedValue({
      practiceChannelId: channelId,
      tipsChannelId: null,
    });

    await handleDiscordInteraction(interaction as unknown as Interaction, {
      ...services,
      practice: {
        next,
      } as unknown as Parameters<
        typeof handleDiscordInteraction
      >[1]["practice"],
    });

    expect(next).toHaveBeenCalledWith(userId, sessionId);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [],
        content: expect.stringContaining(
          "Qual serviço armazena objetos no `Amazon S3`?",
        ),
      }),
    );
    expect(interaction.editReply.mock.calls[0]?.[0].content).toContain(
      "`Amazon S3`",
    );
    expect(interaction.editReply.mock.calls[0]?.[0].content).not.toContain(
      "**A.** `Amazon S3`",
    );
  });

  it("offers a restart action and displays the updated score after an answer", async () => {
    const userId = "12345678901234569";
    const sessionId = "22345678-9012-3456-7890-123456789012";
    const presentationId = "42345678-9012-3456-7890-123456789012";
    const answer = vi.fn().mockResolvedValue({
      mode: "practice",
      isCorrect: false,
      correctOptionKey: "B",
      correctOptionText: {
        en: "Amazon S3",
        "pt-BR": "Amazon S3",
      },
      explanation: {
        en: "Amazon S3 stores objects.",
        "pt-BR": "O Amazon S3 armazena objetos.",
      },
      services: ["Amazon S3"],
      correctCount: 0,
      incorrectCount: 1,
    });
    const interaction = {
      isChatInputCommand: () => false,
      isButton: () => true,
      isStringSelectMenu: () => false,
      customId: `a:${sessionId}:${presentationId}:${userId}:A`,
      channelId,
      guildId,
      user: { id: userId },
      deferUpdate: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    };
    channelSettings.getSettings.mockResolvedValue({
      practiceChannelId: channelId,
      tipsChannelId: null,
    });

    await handleDiscordInteraction(interaction as unknown as Interaction, {
      ...services,
      practice: {
        answer,
      } as unknown as Parameters<
        typeof handleDiscordInteraction
      >[1]["practice"],
    });

    expect(answer).toHaveBeenCalledWith(userId, sessionId, presentationId, "A");
    const reply = interaction.editReply.mock.calls[0]?.[0];
    expect(reply).toEqual(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining(
                "**Corretas:** 0 · **Erradas:** 1",
              ),
            }),
          }),
        ],
      }),
    );
    const actionRow = reply?.components?.[0]?.toJSON();
    expect(actionRow?.components).toEqual([
      expect.objectContaining({ label: "Próxima pergunta" }),
      expect.objectContaining({ label: "Recomeçar prática" }),
    ]);
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
