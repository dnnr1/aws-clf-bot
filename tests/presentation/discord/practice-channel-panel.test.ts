import { ChannelType, type Client } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import type { BotChannelMessageRepository } from "../../../src/application/discord/bot-channel-message-repository.js";
import type { PracticeService } from "../../../src/application/study/practice-service.js";
import type { StudyQuestion } from "../../../src/domain/study/question.js";
import { maintainPracticeChannelPanel } from "../../../src/presentation/discord/practice-channel-panel.js";

describe("maintainPracticeChannelPanel", () => {
  it("posts an active question with answer buttons instead of a start button", async () => {
    const sentMessage = { id: "message-id" };
    const send = vi.fn().mockResolvedValue(sentMessage);
    const channel = {
      id: "channel-id",
      guildId: "guild-id",
      type: ChannelType.GuildText,
      messages: { fetch: vi.fn() },
      send,
    };
    const client = {
      user: { id: "bot-id" },
      channels: { fetch: vi.fn().mockResolvedValue(channel) },
    };
    const messages: BotChannelMessageRepository = {
      findMessage: vi.fn().mockResolvedValue(null),
      saveMessage: vi.fn().mockResolvedValue(undefined),
    };
    const question: StudyQuestion = {
      id: "86b19e28-4c80-4fc6-9aa4-bddf4b574919",
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
    };
    const practice = {
      getRandomQuestion: vi.fn().mockResolvedValue(question),
    };

    await maintainPracticeChannelPanel(
      client as unknown as Client,
      "guild-id",
      "channel-id",
      messages,
      practice as unknown as PracticeService,
    );

    expect(practice.getRandomQuestion).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
    const payload = send.mock.calls[0]?.[0];
    expect(payload.embeds[1].toJSON().description).toContain(
      "Qual serviço armazena objetos no `Amazon S3`?",
    );
    expect(payload.embeds[1].toJSON().description).toContain("`Amazon S3`");
    expect(payload.embeds[1].toJSON().description).toContain(
      "**A.** Amazon S3",
    );
    expect(payload.embeds[1].toJSON().description).not.toContain(
      "**A.** `Amazon S3`",
    );
    expect(payload.embeds[1].toJSON().description).toContain("**English**");
    expect(payload.embeds[1].toJSON().description).not.toMatch(
      /correto|errado|correct|incorrect/i,
    );
    const buttons = payload.components[0].toJSON().components;
    expect(
      buttons.map((button: { custom_id: string }) => button.custom_id),
    ).toEqual([
      `c:${question.id}:A`,
      `c:${question.id}:B`,
      `c:${question.id}:C`,
      `c:${question.id}:D`,
    ]);
    expect(
      buttons.some(
        (button: { custom_id: string }) =>
          button.custom_id === "start-practice",
      ),
    ).toBe(false);
    expect(messages.saveMessage).toHaveBeenCalledWith(
      "practice-introduction-guild-id",
      "channel-id",
      "message-id",
    );
  });
});
