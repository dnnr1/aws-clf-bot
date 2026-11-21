import { describe, expect, it, vi } from "vitest";
import type { GuildChannelSettingsRepository } from "../../../src/application/discord/guild-channel-settings-repository.js";
import { GuildChannelSettingsService } from "../../../src/application/discord/guild-channel-settings-service.js";

function createRepository(
  storedSettings: {
    guildId: string;
    practiceChannelId: string | null;
    tipsChannelId: string | null;
  } | null = null,
): GuildChannelSettingsRepository {
  return {
    findByGuildId: vi.fn(async (guildId) =>
      storedSettings?.guildId === guildId ? storedSettings : null,
    ),
    setPracticeChannel: vi.fn().mockResolvedValue(undefined),
    setTipsChannel: vi.fn().mockResolvedValue(undefined),
  };
}

describe("GuildChannelSettingsService", () => {
  it("uses environment defaults only for their configured server", async () => {
    const service = new GuildChannelSettingsService(createRepository(), {
      guildId: "12345678901234567",
      practiceChannelId: "12345678901234568",
      tipsChannelId: "12345678901234569",
    });

    await expect(service.getSettings("12345678901234567")).resolves.toEqual({
      practiceChannelId: "12345678901234568",
      tipsChannelId: "12345678901234569",
    });
    await expect(service.getSettings("22345678901234567")).resolves.toEqual({
      practiceChannelId: null,
      tipsChannelId: null,
    });
  });

  it("prefers saved settings over environment defaults", async () => {
    const repository = createRepository({
      guildId: "12345678901234567",
      practiceChannelId: "12345678901234570",
      tipsChannelId: null,
    });
    const service = new GuildChannelSettingsService(repository, {
      guildId: "12345678901234567",
      practiceChannelId: "12345678901234568",
      tipsChannelId: "12345678901234569",
    });

    await expect(service.getSettings("12345678901234567")).resolves.toEqual({
      practiceChannelId: "12345678901234570",
      tipsChannelId: "12345678901234569",
    });
  });

  it("caches settings after loading them once", async () => {
    const repository = createRepository();
    const service = new GuildChannelSettingsService(repository, {
      guildId: undefined,
      practiceChannelId: null,
      tipsChannelId: null,
    });

    await service.getSettings("12345678901234567");
    await service.getSettings("12345678901234567");

    expect(repository.findByGuildId).toHaveBeenCalledTimes(1);
  });

  it("persists channel changes for the selected server", async () => {
    const repository = createRepository();
    const service = new GuildChannelSettingsService(repository, {
      guildId: undefined,
      practiceChannelId: null,
      tipsChannelId: null,
    });

    await service.setPracticeChannel("12345678901234567", "12345678901234568");
    await service.setTipsChannel("12345678901234567", "12345678901234569");

    expect(repository.setPracticeChannel).toHaveBeenCalledWith(
      "12345678901234567",
      "12345678901234568",
    );
    expect(repository.setTipsChannel).toHaveBeenCalledWith(
      "12345678901234567",
      "12345678901234569",
    );
  });

  it("preserves concurrent practice and tips updates in its cache", async () => {
    const repository = createRepository();
    const service = new GuildChannelSettingsService(repository, {
      guildId: undefined,
      practiceChannelId: null,
      tipsChannelId: null,
    });

    await Promise.all([
      service.setPracticeChannel("12345678901234567", "12345678901234568"),
      service.setTipsChannel("12345678901234567", "12345678901234569"),
    ]);

    await expect(service.getSettings("12345678901234567")).resolves.toEqual({
      practiceChannelId: "12345678901234568",
      tipsChannelId: "12345678901234569",
    });
  });
});
