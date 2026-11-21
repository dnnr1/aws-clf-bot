import { describe, expect, it, vi } from "vitest";
import { logger } from "../../../src/infrastructure/logging/logger.js";

describe("logger", () => {
  it("redacts Discord tokens and database passwords from errors", () => {
    const discordToken = `${"a".repeat(24)}.${"b".repeat(6)}.${"c".repeat(27)}`;
    const databaseUrl =
      "postgresql://study-user:secret-password@localhost:5432/study";
    const output = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      logger.error("test.failure", new Error(`${discordToken} ${databaseUrl}`));

      const loggedMessage = String(output.mock.calls[0]?.[0]);
      expect(loggedMessage).not.toContain(discordToken);
      expect(loggedMessage).not.toContain("secret-password");
      expect(loggedMessage).toContain("[REDACTED]");
    } finally {
      output.mockRestore();
    }
  });
});
