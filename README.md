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

   The channel IDs are optional environment defaults. When configured, they must refer to text channels in `DISCORD_GUILD_ID` (or in the same server when that ID is omitted). Otherwise, a server administrator can configure channels in Discord. The bot needs permission to view/send messages and embed links in both channels, plus read message history in the practice channel to maintain its introduction panel. Users need permission to use application commands. Keep `.env` private. Never commit it or share the Discord token. The committed `.env.example` contains placeholders only.

3. From a WSL terminal, start PostgreSQL in the project directory:

   ```sh
   docker compose up -d
   ```

   The database is bound to localhost. If port `5432` is already in use, set `POSTGRES_PORT` in `.env` to an available local port and update the port in `DATABASE_URL` to match. The Node.js commands below can run in Windows and connect through WSL's localhost forwarding.

4. Apply database migrations:

   ```powershell
   npm run db:migrate
   npm run db:seed
   ```

   The seed command validates and inserts the versioned question data in `data/questions/`. Existing question IDs are not overwritten. When the Drizzle schema changes, generate a new migration with `npm run db:generate`, review the SQL, and commit both the schema and migration.

   The question bank contains more than 200 original questions, weighted to the CLF-C02 exam domains. Exam simulation selects 65 questions across the required 16/19/22/8 domain distribution, avoids duplicate question families, and runs for 90 minutes. Daily tips are published in Brazilian Portuguese at 12:00, 16:00, and 20:00 UTC per server. When a tips channel becomes available, the bot publishes an initial tip immediately and reserves the first daily slot for it; the server receives at most three tips per UTC day. Missed slots are not sent later, and failed or ambiguous posts are not retried.

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

Server administrators can set channels without restarting the bot:

- `/set-practice-channel channel:#practice`
- `/set-tips-channel channel:#tips`

These settings are stored per server and override the optional `.env` defaults. Only server administrators can run these commands, and the selected channel must be a text channel in the same server.

The practice channel contains a persistent introduction panel with an **Iniciar os exercícios / Start exercises** button. Clicking it starts your private, continuous session; no `/practice` command is required. Correct/incorrect feedback appears only after you select an answer, and moving to the next question clears the previous feedback. Related service names are highlighted in question prompts, not in answer options. The session cycles through the question bank without ending and offers **Next question** and **Restart practice** controls.

The tips channel receives an initial sourced tip when the bot starts or an administrator configures the channel, followed by up to three tips per UTC day.

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
