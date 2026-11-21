import { ChannelType, type Client } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import type { DailyTipPublicationRepository } from "../../../src/application/study/daily-tip-publication-repository.js";
import type { Logger } from "../../../src/infrastructure/logging/logger.js";
import type { DailyTip } from "../../../src/infrastructure/questions/daily-tip-schema.js";
import {
  getDueDailyTipSlot,
  publishImmediateDailyTip,
  startDailyTipScheduler,
} from "../../../src/infrastructure/discord/daily-tip-scheduler.js";

describe("getDueDailyTipSlot", () => {
  it.each([
    ["2026-11-21T12:00:00.000Z", 1],
    ["2026-11-21T16:59:00.000Z", 2],
    ["2026-11-21T20:30:00.000Z", 3],
  ])("returns the scheduled UTC slot for %s", (timestamp, expectedSlot) => {
    expect(getDueDailyTipSlot(new Date(timestamp))).toBe(expectedSlot);
  });

  it("does not backfill a missed publication slot", () => {
    expect(getDueDailyTipSlot(new Date("2026-11-21T13:00:00.000Z"))).toBeNull();
  });
});

describe("startDailyTipScheduler", () => {
  it("publishes an initial tip immediately and reserves the first daily slot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T10:00:00.000Z"));

    let resolvePublication: () => void = () => undefined;
    const publicationSent = new Promise<void>((resolve) => {
      resolvePublication = resolve;
    });
    const channelSend = vi.fn().mockResolvedValue({ id: "message-id" });
    const client = {
      channels: {
        fetch: vi.fn().mockResolvedValue({
          type: ChannelType.GuildText,
          guildId: "guild-id",
          send: channelSend,
        }),
      },
    };
    const tip: DailyTip = {
      id: "initial-tip",
      domainId: "cloud-concepts",
      title: { en: "Cloud value", "pt-BR": "Valor da nuvem" },
      content: { en: "Tip", "pt-BR": "Dica" },
      source: { label: "AWS", url: "https://aws.amazon.com/" },
    };
    const publications: DailyTipPublicationRepository = {
      hasPublicationForChannel: vi.fn().mockResolvedValue(false),
      claimInitialPublication: vi.fn().mockResolvedValue(true),
      claimPublication: vi.fn().mockResolvedValue(false),
      markPublicationSent: vi.fn().mockImplementation(async () => {
        resolvePublication();
      }),
    };
    const logger: Logger = {
      info: vi.fn(),
      error: vi.fn(),
    };
    const stop = startDailyTipScheduler(
      client as unknown as Client,
      async () => [{ guildId: "guild-id", channelId: "channel-id" }],
      [tip],
      publications,
      logger,
    );

    try {
      await publicationSent;

      expect(publications.claimInitialPublication).toHaveBeenCalledWith(
        "2026-11-21",
        "guild-id",
        "channel-id",
        "initial-tip",
      );
      expect(publications.claimPublication).not.toHaveBeenCalled();
      expect(channelSend).toHaveBeenCalledOnce();
      const embed = channelSend.mock.calls[0]?.[0].embeds[0].toJSON();
      expect(embed.title).toBe("Valor da nuvem");
      expect(
        embed.fields?.map((field: { name: string }) => field.name),
      ).toEqual(["Dica", "Fonte"]);
    } finally {
      stop();
      vi.useRealTimers();
    }
  });
});

describe("publishImmediateDailyTip", () => {
  it("uses the next available daily slot when a channel is configured after startup", async () => {
    const channelSend = vi.fn().mockResolvedValue({ id: "message-id" });
    const client = {
      channels: {
        fetch: vi.fn().mockResolvedValue({
          type: ChannelType.GuildText,
          guildId: "guild-id",
          send: channelSend,
        }),
      },
    };
    const tip: DailyTip = {
      id: "immediate-tip",
      domainId: "cloud-concepts",
      title: { en: "Cloud value", "pt-BR": "Valor da nuvem" },
      content: { en: "Tip", "pt-BR": "Dica" },
      source: { label: "AWS", url: "https://aws.amazon.com/" },
    };
    const publications: DailyTipPublicationRepository = {
      hasPublicationForChannel: vi.fn().mockResolvedValue(false),
      claimInitialPublication: vi.fn().mockResolvedValue(false),
      claimPublication: vi
        .fn()
        .mockImplementation(async (_date, _guildId, slot) => slot === 2),
      markPublicationSent: vi.fn().mockResolvedValue(undefined),
    };
    const logger: Logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    await expect(
      publishImmediateDailyTip(
        client as unknown as Client,
        { guildId: "guild-id", channelId: "channel-id" },
        [tip],
        publications,
        logger,
        new Date("2026-11-21T10:00:00.000Z"),
      ),
    ).resolves.toBe(true);

    expect(publications.claimInitialPublication).toHaveBeenCalledWith(
      "2026-11-21",
      "guild-id",
      "channel-id",
      "immediate-tip",
    );
    expect(publications.claimPublication).toHaveBeenNthCalledWith(
      1,
      "2026-11-21",
      "guild-id",
      1,
      "channel-id",
      "immediate-tip",
    );
    expect(publications.claimPublication).toHaveBeenNthCalledWith(
      2,
      "2026-11-21",
      "guild-id",
      2,
      "channel-id",
      "immediate-tip",
    );
    expect(publications.markPublicationSent).toHaveBeenCalledWith(
      "2026-11-21",
      "guild-id",
      2,
      "message-id",
    );
    expect(channelSend).toHaveBeenCalledOnce();
  });

  it("does not exceed the three-tip daily cap", async () => {
    const channelSend = vi.fn();
    const client = {
      channels: { fetch: vi.fn() },
    };
    const tip: DailyTip = {
      id: "immediate-tip",
      domainId: "cloud-concepts",
      title: { en: "Cloud value", "pt-BR": "Valor da nuvem" },
      content: { en: "Tip", "pt-BR": "Dica" },
      source: { label: "AWS", url: "https://aws.amazon.com/" },
    };
    const publications: DailyTipPublicationRepository = {
      hasPublicationForChannel: vi.fn().mockResolvedValue(false),
      claimInitialPublication: vi.fn().mockResolvedValue(false),
      claimPublication: vi.fn().mockResolvedValue(false),
      markPublicationSent: vi.fn(),
    };

    await expect(
      publishImmediateDailyTip(
        client as unknown as Client,
        { guildId: "guild-id", channelId: "channel-id" },
        [tip],
        publications,
        { info: vi.fn(), error: vi.fn() },
        new Date("2026-11-21T10:00:00.000Z"),
      ),
    ).resolves.toBe(false);

    expect(publications.claimPublication).toHaveBeenCalledTimes(3);
    expect(channelSend).not.toHaveBeenCalled();
  });
});
