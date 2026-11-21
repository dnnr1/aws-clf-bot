# Copilot Instructions

## Project context

This project is a Discord bot written in TypeScript. Before changing features, locate the entry point and trace the existing flow through client initialization, events, commands, and services. Do not assume a Discord library or folder structure; follow the dependencies and patterns present in the code.

## Build, test, and lint

Check `package.json` scripts and project configuration before running or recommending commands. No build, test, or lint scripts have been confirmed yet. To run a single test, use the filter or selector documented by the configured test runner; do not assume Jest, Vitest, or another runner.

## Codebase conventions

- Preserve the existing Discord interaction response flow, including reply, defer, and error handling.
- When changing commands or events, keep their existing definition, registration, and handling points aligned; trace this flow before modifying any step.
- Keep bot credentials out of source code and follow the project's existing configuration mechanism.
- Use types provided by installed dependencies and respect the permissions and intents required by the affected flow.

