import { describe, expect, it, vi } from "vitest";
import { UserPreferencesService } from "../../../src/application/users/user-preferences-service.js";
import type { UserPreferencesRepository } from "../../../src/application/users/user-preferences-repository.js";

function createRepository(): UserPreferencesRepository {
  return {
    findLocale: vi.fn().mockResolvedValue(null),
    saveLocale: vi.fn().mockResolvedValue(undefined),
  };
}

describe("UserPreferencesService", () => {
  it("defaults users without a saved preference to Brazilian Portuguese", async () => {
    const repository = createRepository();
    const service = new UserPreferencesService(repository);

    await expect(service.getLocale("12345678901234567")).resolves.toBe("pt-BR");
  });

  it("persists a supported locale", async () => {
    const repository = createRepository();
    const service = new UserPreferencesService(repository);

    await service.changeLocale("12345678901234567", "pt-BR");

    expect(repository.saveLocale).toHaveBeenCalledWith(
      "12345678901234567",
      "pt-BR",
    );
  });

  it("rejects unsupported locales without writing them", async () => {
    const repository = createRepository();
    const service = new UserPreferencesService(repository);

    await expect(
      service.changeLocale("12345678901234567", "fr"),
    ).rejects.toThrow("Unsupported user locale.");
    expect(repository.saveLocale).not.toHaveBeenCalled();
  });
});
