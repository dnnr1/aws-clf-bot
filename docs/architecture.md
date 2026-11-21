# Architecture Proposal

**Status:** Approved baseline for incremental implementation.

## Goals and boundaries

The bot presents AWS CLF-C02 study features through Discord while keeping quiz rules, progress calculations, and session invariants independent of Discord.js and database details. PostgreSQL is the persistent source of truth. English and Brazilian Portuguese are presentation locales, not separate domain models.

## Dependency direction

```text
Discord.js presentation ----> Application use cases ----> Domain
                                      ^
                                      |
Infrastructure adapters -------------+
(implement application ports)
```

The domain must not import Discord.js, Drizzle, or transport-specific types. Application services depend on domain types and ports. Infrastructure implements those ports and may depend on application/domain contracts, not the other way around. The composition root creates the concrete adapters and injects them into the application and presentation layers.

## Proposed responsibilities

### Domain

- Model questions, localized options, exam domains, study sessions, answers, and user progress.
- Enforce rules such as one accepted answer per question per session, valid answer options, exam duration, and daily-attempt limits.
- Calculate accuracy, streaks, exam performance, and per-domain results from answer records.
- Keep time and randomness behind injectable abstractions where they affect deterministic rules or tests.

### Application

- Orchestrate use cases: start a mode, fetch the next question, submit an answer, complete a session, change locale, configure server channels, and query statistics.
- Define repository and service ports needed by each use case.
- Own transaction boundaries for operations that change related records together.
- Return transport-independent results that the Discord presentation layer can render.

### Infrastructure

- Implement repositories with Drizzle and PostgreSQL, schema migrations, indexes, and database constraints.
- Persist per-server practice/tips channel overrides and expose optional environment defaults.
- Load validated question-bank records without coupling question content to application logic.
- Select exam questions across the weighted domain distribution while avoiding duplicate question families in one exam.
- Manage the persistent practice-channel introduction and scheduled, data-driven learning tips through Discord adapters.
- Validate environment variables, provide structured logging, and manage database/client lifecycle.
- Provide adapters for time, randomness, and other external dependencies required by application services.

### Discord presentation

- Initialize the Discord.js client, register slash commands, and route commands and component interactions to application use cases.
- Restrict channel configuration commands to server administrators at registration and runtime; accept only text channels from the invoking server.
- Restrict study commands and components to the configured practice channel, while keeping all individual study replies ephemeral. Start practice from the introduction panel rather than a slash command.
- Keep practice sessions continuous, persist cumulative counts, cycle through question presentations, and let users restart into a fresh session.
- Convert Discord payloads into validated application inputs; format results as localized messages, embeds, and buttons.
- Keep authorization, interaction ownership checks, Discord response timing, and expired-interaction handling at this boundary, backed by application/session validation.
- Keep user-facing text in English and `pt-BR` locale resources. Slash-command names and descriptions are English.

## Data model outline

Use normalized relational tables, with exact columns and constraints to be defined alongside migrations:

- `users`: Discord user identity and lifecycle metadata.
- `user_preferences`: selected locale and other user-level settings.
- `guild_channel_settings`: per-server practice and tips channel overrides.
- `bot_channel_messages`: persistent IDs for bot-managed channel panels.
- `daily_tip_publications`: per-server UTC slot claims that prevent duplicate tips.
- `questions` and `question_options`: domain, difficulty, localized prompts/options/explanations, answer key, objectives, services, and source references.
- `study_sessions`: owner, mode, state, start/end timestamps, and persisted session lifecycle.
- `session_questions`: one row per presented question occurrence, including repeated practice questions.
- `user_answers`: accepted answer, correctness, and answer timestamp linked to a session and question presentation.
- `daily_challenges`: per-user/per-day challenge state and completion.
- `exam_results`: completed exam summary and domain breakdown, linked to its session.

Store Discord IDs without converting them to numeric database types. Add a unique constraint for a presentation within a session so retries or concurrent interactions cannot record duplicate answers while practice may present the same question more than once. Enforce daily uniqueness per user and challenge date. Derive statistics from `user_answers`; any cached aggregate must be rebuildable and must not become the sole source of truth.

## Key interaction flows

### Answering a quiz question

1. The presentation adapter checks interaction ownership and parses the component payload.
2. The application use case loads the session and question, then validates ownership, session state, and selected option.
3. In a transaction, persist the answer once and update session state if needed.
4. Return a domain result; the presentation adapter renders localized feedback and disables or replaces the answered controls.

### Exam simulation

Create a 65-question, 90-minute session with a persisted question order. Validate each submission against the session owner and deadline. Resume or completion behavior must use persisted session state rather than relying on a Discord message remaining available.

### Statistics

Compute totals, accuracy, streaks, session history, and domain performance from persisted answers and sessions. Define leaderboard minimum-activity rules in the application policy and exclude users who do not meet that threshold.

## Cross-cutting decisions

- **Localization:** Resolve a user's stored locale at the application/presentation boundary; keep domain outcomes language-neutral.
- **Channel configuration:** Resolve per-server database overrides before optional environment defaults; cache settings after startup and update them on administrator commands.
- **Validation:** Use Zod at environment, Discord input, and question-ingestion boundaries. Domain invariants still need enforcement in domain/application logic.
- **Concurrency:** Back application checks with database uniqueness/transaction guarantees for answer submission and daily attempts.
- **Reliability:** Handle Discord interaction expiry and API errors explicitly; close the database and Discord client during graceful shutdown.
- **Testing:** Keep domain tests independent of infrastructure. Test persistence constraints and transactions against a test database in integration tests.
- **Content provenance:** Maintain source references for question objectives and verify the current official exam guide during question review.

## Risks to resolve during detailed design

- Daily challenge timezone and the definition of a “day”.
- Streak behavior when a user misses a day or changes locale.
- Exam scoring and pass/performance thresholds shown to users.
- Question-bank authoring, review, seeding, and versioning workflow.
- Leaderboard minimum activity and tie-breaking rules.
- Deployment target and PostgreSQL provisioning.

Resolve these in the relevant feature specifications before implementation depends on them.
