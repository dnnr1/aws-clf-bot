# AWS CLF Study Bot - Project Specification

**Status:** Approved requirements baseline for incremental implementation.

## Purpose

Help members of a private Discord server prepare for the AWS Certified Cloud Practitioner (CLF-C02) exam through original practice questions, interactive study modes, and progress feedback.

## Users and language

- Identify users by Discord user ID.
- Let each user choose English or Brazilian Portuguese (`pt-BR`) with `/language`; persist the preference and allow changes at any time.
- Localize all user-facing questions, explanations, feedback, and statistics.
- Keep slash-command names and descriptions in English.

## Functional requirements

### Question bank

Cover all four CLF-C02 domains:

1. Cloud Concepts.
2. Security and Compliance.
3. Cloud Technology and Services.
4. Billing, Pricing, and Support.

Questions must be original and scenario-oriented where suitable, use plausible distractors, and cover the official exam objectives. The [official AWS CLF-C02 exam guide](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02.html) is the primary coverage reference. Do not copy confidential exam questions, exam dumps, or third-party question banks.

Each validated question contains a unique identifier, domain, difficulty, English and `pt-BR` question text, four localized options, correct option identifier, localized explanation, related AWS services, exam objectives, and source references when available. Adding question content must not require changing application logic.

### Study modes

- **Daily Challenge:** One attempt per user per day, completion tracking, and daily streaks.
- **Practice:** Ongoing sessions that record each answer and allow users to continue.
- **Exam Simulation:** 65 randomized questions, 90 minutes, final score/performance, and domain breakdown.
- **Domain Practice:** Practice a selected exam domain and track its performance separately.

All modes use four-option multiple-choice questions and Discord buttons. After an answer, indicate correctness, identify the correct option, provide a concise localized explanation, update persisted progress, and prevent a second answer to the same question in the same attempt.

### Commands and progress

- `/language`: select and persist the preferred locale.
- `/help`: show available commands.
- `/question`: show a random question.
- `/daily`, `/practice`, `/exam`: start or resume the corresponding mode as specified.
- `/stats`: totals, correct/incorrect answers, accuracy, current and longest streak, and study sessions.
- `/leaderboard`: rank eligible users by study performance and show accuracy and answered-question count.
- `/progress`: show performance over time and by exam domain, including weak areas.
- `/history`: show recent study sessions and prior exam results.

Statistics must be based on persisted answer records, not solely on cached counters. Leaderboard eligibility and tie-breaking, streak day boundaries, and detailed session-resume behavior require feature-level decisions before implementation.

## Data and persistence

Persist users, preferences, questions/options, study sessions, answers, daily challenges, and exam results in PostgreSQL through Drizzle. Use migrations, relational constraints, indexes, and transactions. Store Discord IDs as identifiers. Prevent duplicate answers within a session at both application and database levels.

## Quality and security requirements

- TypeScript strict mode; validate external inputs and environment configuration with Zod.
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
