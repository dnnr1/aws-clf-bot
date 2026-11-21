import { ChannelType, type Client } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import type { BotChannelMessageRepository } from "../../../src/application/discord/bot-channel-message-repository.js";
import type { PracticeService } from "../../../src/application/study/practice-service.js";
import type { UserPreferencesService } from "../../../src/application/users/user-preferences-service.js";
import { maintainPracticeChannelPanel } from "../../../src/presentation/discord/practice-channel-panel.js";

describe("maintainPracticeChannelPanel", () => {
  it("posts an introduction with a private practice start button", async () => {
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
    const practiceService = {
      start: vi.fn(),
    } as unknown as PracticeService;
    const preferences = {
      getLocale: vi.fn().mockResolvedValue("pt-BR"),
    } as unknown as UserPreferencesService;

    await maintainPracticeChannelPanel(
      client as unknown as Client,
      "guild-id",
      "channel-id",
      messages,
      practiceService,
      preferences,
    );

    expect(send).toHaveBeenCalledOnce();
    const payload = send.mock.calls[0]?.[0];
    expect(payload.embeds).toHaveLength(1);
    expect(payload.embeds[0].toJSON().description).toContain(
      "Iniciar os exercícios",
    );
    const buttons = payload.components[0].toJSON().components;
    expect(buttons).toHaveLength(1);
    expect(buttons[0].custom_id).toBe("start-practice");
    expect(buttons[0].label).toBe("Iniciar os exercícios / Start exercises");
    expect(messages.saveMessage).toHaveBeenCalledWith(
      "practice-introduction-guild-id",
      "channel-id",
      "message-id",
    );
  });
});
