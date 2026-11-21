# AWS CLF Study Bot

A Discord study bot for members preparing for the AWS Certified Cloud Practitioner (CLF-C02) exam.

## Requirements

- Node.js 22.12 or newer
- npm
- Docker Desktop for the local PostgreSQL database
- A Discord bot application and token for running the bot

## Local setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create a local environment file and replace the example values:

   ```powershell
   Copy-Item .env.example .env
   ```

   Keep `.env` private. Never commit it or share the Discord token. The committed `.env.example` contains placeholders only.

3. Start PostgreSQL:

   ```powershell
   docker compose up -d
   ```

4. Run the available checks:

   ```powershell
   npm run build
   npm run typecheck
   npm test
   npm run lint
   npm run format:check
   ```

The initial setup provides the TypeScript toolchain, environment validation, and local database service. Bot commands and application startup will be added in later implementation phases.

## Discord MCP

The workspace MCP configuration references `DISCORD_TOKEN` and `DISCORD_GUILD_ID` from the environment of the process that launches VS Code. VS Code does not automatically load `.env` for MCP servers; do not put real credentials in `.mcp.json`.

## Tests

Run one test file:

```powershell
npm test -- tests/infrastructure/config/environment.test.ts
```

## Architecture and requirements

- [Architecture proposal](docs/architecture.md)
- [Project specification](docs/specifications/project.md)
