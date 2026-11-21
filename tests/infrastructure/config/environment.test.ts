import { describe, expect, it } from "vitest";
import { parseEnvironment } from "../../../src/infrastructure/config/environment.js";

const validEnvironment = {
  DISCORD_TOKEN: "test-discord-token",
  DISCORD_GUILD_ID: "1040777384711954593",
  DISCORD_PRACTICE_CHANNEL_ID: "1040777384711954594",
  DISCORD_TIPS_CHANNEL_ID: "1040777384711954595",
  DATABASE_URL: "postgresql://user:password@localhost:5432/aws_clf_bot",
};

describe("parseEnvironment", () => {
  it("parses a valid environment", () => {
    expect(parseEnvironment(validEnvironment)).toEqual(validEnvironment);
  });

  it("rejects a missing Discord token", () => {
    expect(() =>
      parseEnvironment({
        DISCORD_GUILD_ID: validEnvironment.DISCORD_GUILD_ID,
        DATABASE_URL: validEnvironment.DATABASE_URL,
      }),
    ).toThrow();
  });

  it("rejects non-PostgreSQL database URLs", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        DATABASE_URL: "https://localhost/aws_clf_bot",
      }),
    ).toThrow("DATABASE_URL must use the postgres or postgresql protocol");
  });

  it("rejects malformed guild IDs", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        DISCORD_GUILD_ID: "not-a-discord-id",
      }),
    ).toThrow();
  });

  it("rejects malformed configured channel IDs", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        DISCORD_TIPS_CHANNEL_ID: "not-a-discord-id",
      }),
    ).toThrow();
  });

  it("requires both configured channel IDs", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        DISCORD_TIPS_CHANNEL_ID: undefined,
      }),
    ).toThrow();
  });
});
