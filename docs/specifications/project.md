# AWS CLF Study Bot - Project Specification

**Status:** Approved requirements baseline for incremental implementation.

## Purpose

Help members of a private Discord server prepare for the AWS Certified Cloud Practitioner (CLF-C02) exam through original practice questions, interactive study modes, and progress feedback.

## Users and language

- Identify users by Discord user ID.
- Default new users to Brazilian Portuguese (`pt-BR`); let each user choose English or Brazilian Portuguese with `/language`, persist the preference, and allow changes at any time.
- Localize all user-facing questions, explanations, feedback, and statistics.
- Keep slash-command names and descriptions in English.

## Discord channels and interactions

- Use `DISCORD_PRACTICE_CHANNEL_ID` and `DISCORD_TIPS_CHANNEL_ID` as optional default channel IDs. A server administrator can override them at runtime with `/set-practice-channel` and `/set-tips-channel`; store overrides per server, take precedence over environment defaults, and apply them without restarting the bot.
- Restrict both channel-setting commands to users with the Discord Administrator permission, enforced in command registration and rechecked for each interaction. Accept only text channels belonging to the invoking server.
- Maintain one bot-authored introduction panel with an exercise-start button in the practice channel; update the same message on startup and remove the previous panel when an administrator changes channels.
- Start a private, continuous practice session when a user selects the panel button. Do not provide a `/practice` command.
- Accept study commands and component interactions only in the configured practice channel.
- Keep each user's correctness feedback, explanation, score, and questions private with ephemeral interaction replies. The shared practice channel contains only the introduction panel.
- Publish one sourced learning tip in Brazilian Portuguese as soon as a tips channel is available, then publish scheduled tips at 12:00, 16:00, and 20:00 UTC. The initial tip reserves the first daily slot. Reserve each slot once before sending; do not retry failed or ambiguous sends or backfill missed slots. This at-most-once policy limits publications to three per server per UTC day.

## Functional requirements

### Question bank

Cover all four CLF-C02 domains:

1. Cloud Concepts.
2. Security and Compliance.
3. Cloud Technology and Services.
4. Billing, Pricing, and Support.

Questions must be original and scenario-oriented where suitable, use plausible distractors, and cover the official exam objectives. The [official AWS CLF-C02 exam guide](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02.html) is the primary coverage reference. Do not copy confidential exam questions, exam dumps, or third-party question banks.

The bank contains at least 200 original questions, weighted approximately to the official domain percentages (24%, 30%, 34%, and 12%). Each validated question contains a unique identifier and family identifier, domain, difficulty, English and `pt-BR` question text, four localized options, correct option identifier, localized explanation, related AWS services, exam objectives, and source references when available. Questions in the same family are variants of one concept; a single exam uses no more than one variant from each family. Adding question content must not require changing application logic.

### Study modes

- **Daily Challenge:** One attempt per user per day, completion tracking, and daily streaks.
- **Practice:** Continuous sessions that record every answer, cycle through the question bank without ending, and keep a cumulative score. A restart control abandons the current session and begins a new session with a reset score.
- **Exam Simulation:** 65 randomized questions, 90 minutes, final score/performance, and domain breakdown.
- **Domain Practice:** Practice a selected exam domain and track its performance separately.

All modes use four-option multiple-choice questions and Discord buttons. Display correct and incorrect answer counts for the current session above each question and after each answer. Highlight related service names in question prompts with inline code formatting, deriving names and aliases from question metadata; do not format answer options as inline code. Show correctness only after an option is selected; after the user advances, remove the previous answer feedback from the displayed message. After an answer, identify the correct option, provide a concise localized explanation, update persisted progress, and prevent a second answer to the same question in the same attempt.

### Commands and progress

- `/language`: select and persist the preferred locale.
- `/help`: show available commands.
- `/question`: show a random question.
- `/daily`, `/exam`: start or resume the corresponding mode as specified. Practice starts from the persistent practice-channel panel.
- `/stats`: totals, correct/incorrect answers, accuracy, current and longest streak, and study sessions.
- `/set-practice-channel`: set the server's private practice channel (Administrator permission required).
- `/set-tips-channel`: set the server's daily learning tips channel (Administrator permission required).
- `/leaderboard`: rank eligible users by study performance and show accuracy and answered-question count.
- `/progress`: show performance over time and by exam domain, including weak areas.
- `/history`: show recent study sessions and prior exam results.

Statistics must be based on persisted answer records, not solely on cached counters. For `/stats`, count all persisted study sessions and submitted answers for the user. Accuracy is correct answers divided by submitted answers, and unanswered sessions do not affect accuracy. Activity days use UTC dates derived from persisted answer timestamps, independent of user locale. The current streak includes consecutive active UTC dates ending today, or yesterday when today has no activity yet; the longest streak is the largest consecutive run of active UTC dates. Any submitted answer counts as activity, whether correct or incorrect.

`/leaderboard` uses the top 10 eligible users. Eligibility requires at least 10 persisted submitted answers. Rank by accuracy descending, then total answered questions descending, then correct answers descending, and finally Discord user ID ascending. Show each user's accuracy and correct-answer/answered-question count.

Exam simulations require 65 active questions from distinct question families, distributed as 16, 19, 22, and 8 questions across the four domains, and end after 90 minutes with a visible countdown. If the question bank cannot meet this distribution, do not start an incomplete exam; report that the question bank is still being populated. Persist every completed result and the per-domain breakdown. A user's best result is the highest correct-answer count; because all exams contain 65 questions, this also determines the highest accuracy. Incomplete or expired attempts do not count as completed results.

## Data and persistence

Persist users, preferences, questions/options, study sessions, question presentations, answers, daily challenges, and exam results in PostgreSQL through Drizzle. Use migrations, relational constraints, indexes, and transactions. Store Discord IDs as identifiers. Prevent duplicate answers to the same presentation at both application and database levels while allowing a practice session to revisit question families.

Persist per-server channel overrides and the practice introduction's message ID so configuration and panels survive restarts. Persist daily tip publications with a UTC date, server ID, and one of three scheduled slots; a unique date/server/slot constraint prevents duplicate publications and enforces the daily cap.

## Quality and security requirements

- TypeScript strict mode; validate external inputs and environment configuration with Zod.
- Validate optional environment channel IDs and selected Discord text channels.
- Check server Administrator permission again in the handler for channel-configuration commands.
- Keep business logic independent of Discord.js.
- Verify the user owns each interactive study session; never trust interaction payloads alone.
- Handle interaction expiry, Discord API failures, and database failures explicitly.
- Use structured logging, appropriate rate limiting, graceful shutdown, and secret-safe configuration.
- Use dependency injection where it makes business logic testable; avoid introducing patterns without a concrete need.

## Testing requirements

Prioritize automated tests for domain rules and business logic, including answer validation, duplicate-answer prevention, statistics, exam simulation, and locale selection. Add application-service tests and database integration tests for persistence behavior and constraints. The planned runner is Vitest; exact commands will be documented after project setup.

## Proposed implementation phases

1. Review and approve requirements, specifications, architecture, and risks.
2. Set up the TypeScript project, tooling, Docker development environment, and configuration validation.
3. Define PostgreSQL schema, migrations, and repository adapters.
4. Initialize the Discord client and command/component registration.
5. Implement locale preferences and localization resources.
6. Design validated question ingestion and implement the question/quiz engine.
7. Add statistics, progress, history, and leaderboard.
8. Add daily challenge and domain practice.
9. Add exam simulation and result reporting.
10. Complete reliability, security, test coverage, documentation, and deployment setup.

For each phase, update or create the relevant feature specification, identify implementation tasks and risks, implement incrementally, run focused tests, review the result, update documentation, and commit a focused change. Do not implement the whole application in one step.
