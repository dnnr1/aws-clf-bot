# AWS CLF Study Bot

A Discord study bot for members preparing for the AWS Certified Cloud Practitioner (CLF-C02) exam.

## Requirements

- Node.js 22.12 or newer
- npm
- Docker Engine accessible from WSL for the local PostgreSQL database
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

3. From a WSL terminal, start PostgreSQL in the project directory:

   ```sh
   docker compose up -d
   ```

   The database is bound to localhost. If port `5432` is already in use, set `POSTGRES_PORT` in `.env` to an available local port and update the port in `DATABASE_URL` to match. The Node.js commands below can run in Windows and connect through WSL's localhost forwarding.

4. Apply the initial database migration:

   ```powershell
   npm run db:migrate
   npm run db:seed
   ```

   The seed command validates and inserts the versioned question data in `data/questions/`. Existing question IDs are not overwritten. When the Drizzle schema changes, generate a new migration with `npm run db:generate`, review the SQL, and commit both the schema and migration.

5. Run the available checks:

   ```powershell
   npm run build
   npm run typecheck
   npm test
   npm run lint
   npm run format:check
   ```

6. Build and start the bot:

   ```powershell
   npm run build
   npm start
   ```

On startup, the bot checks the database connection and registers its current slash commands. Set `DISCORD_GUILD_ID` to register commands to one development server; leave it unset to register global commands.

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
