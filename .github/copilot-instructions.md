# Copilot Instructions

## Project

Build a maintainable Discord study bot for the AWS Certified Cloud Practitioner (CLF-C02) exam. The planned stack is TypeScript with strict mode, Node.js, Discord.js, PostgreSQL, Drizzle ORM, Zod, Vitest, ESLint, Prettier, and Docker. Check the actual manifests and configuration before assuming any tool has been installed.

## Language and educational content

- Write all source code, identifiers, database names, file names, documentation, and commit subjects in English.
- User-facing bot messages, questions, explanations, feedback, and statistics must support English and Brazilian Portuguese (`pt-BR`). Slash-command names and descriptions remain in English.
- Create original questions aligned to the official CLF-C02 exam guide. Never use exam dumps, recalled exam questions, or copied question banks.
- Validate each question before adding it: four localized options, one valid correct-option identifier, localized explanation, domain, difficulty, objectives, relevant services, and source references when available.

## Architecture

Read [the architecture proposal](../docs/architecture.md) and [the project specification](../docs/specifications/project.md) before feature work. Keep business rules independent of Discord.js and Drizzle:

- Domain owns study rules and invariants.
- Application services coordinate use cases through ports.
- Infrastructure implements persistence, configuration, logging, and external integrations.
- Discord presentation translates interactions to application requests and localized responses.
- Compose concrete adapters at the application entry point; introduce patterns only where they solve a demonstrated need.

Treat the documents as the proposed baseline. Do not start feature implementation until the initial architecture and development plan have been reviewed and approved. Update the specifications when requirements or decisions change.

## Discord and data conventions

- Keep command and component handling in the presentation boundary; do not put business rules in Discord handlers.
- Verify the owning Discord user and current session state on every quiz component interaction. Do not trust component identifiers or other interaction data as authorization.
- Preserve interaction response and expiration rules, including defer/reply behavior and graceful handling of Discord API failures.
- Persist user answers as the source of truth for statistics. Prevent duplicate answers for the same question in one study session with a database constraint and application validation.
- Use transactions for state changes that must succeed together, including accepting an answer and updating its session.
- Validate environment configuration and external input with Zod at system boundaries. Keep credentials out of source control.
- Use migrations for schema changes. Keep the question bank data-driven so new validated questions do not require application-logic changes.

## Build, test, and lint

The repository does not yet contain a package manifest or runnable build, test, or lint scripts. Once project setup exists, read `package.json` and the tool configuration and use their scripts rather than inventing commands. Vitest is the planned test runner; run a single test through its configured file filter (for example, `vitest run path/to/test-file`) after dependencies are installed.

## Development workflow

Follow specification-driven development: clarify requirements, update the specification and architecture, break approved work into focused tasks, implement incrementally, run relevant checks, and update documentation. Prioritize unit tests for domain rules, then application and database integration tests. Keep Conventional Commit subjects short and in English, with no extra description.

