# Linux Setup

## Requirements

The server needs Git and Docker Engine with the Docker Compose plugin. Node.js is installed inside the bot container.

## 1. Install Docker

Install Docker Engine and the Compose plugin by following the [official instructions for your Linux distribution](https://docs.docker.com/engine/install/). Make sure Docker starts automatically:

```bash
sudo systemctl enable --now docker
```

## 2. Download and configure

```bash
git clone https://github.com/dnnr1/aws-clf-bot.git
cd aws-clf-bot
cp .env.example .env
nano .env
```

In `.env`, set `DISCORD_TOKEN` and replace `POSTGRES_PASSWORD` with a strong URL-safe password. For example, generate one with `openssl rand -hex 32`. The Compose setup configures the database connection automatically; you do not need to change `DATABASE_URL` for deployment. Leave `DISCORD_GUILD_ID` commented out to register global commands, or set it to a server ID to register commands there first. Channel IDs are optional; server administrators can set them in Discord.

Create a Discord application and bot, invite it with the `bot` and `applications.commands` scopes, and grant it permission to view channels, send messages, embed links, and read message history in the practice channel. Users must be allowed to use application commands. Keep `.env` private and never share the bot token.

## 3. Start everything

```bash
sudo docker compose up -d --build
```

That single command builds and starts the bot and PostgreSQL, applies migrations, seeds the question bank, and starts the bot. Both containers restart automatically after a server reboot. PostgreSQL data is kept in a Docker volume, and its host port is bound to localhost only.

Check status or follow the bot logs:

```bash
sudo docker compose ps
sudo docker compose logs -f bot
```

## Update

```bash
git pull --ff-only
sudo docker compose up -d --build
```

The bot applies new migrations and seeds newly added question IDs when it starts. Existing question IDs are not overwritten. Back up PostgreSQL before deploying schema changes.

## Discord channel commands

Server administrators can configure channels without restarting the bot:

- `/set-practice-channel channel:#practice`
- `/set-tips-channel channel:#tips`

These settings are stored per server and override the optional `.env` defaults. Only server administrators can run these commands, and the selected channel must be a text channel in the same server.
