# Contributing to Clonecord

Hey! Thanks for being interested in contributing to Clonecord. Whether it's a bug fix, a new feature, or just improving documentation — every contribution matters and is genuinely appreciated.

## Quick Start

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/your-username/Clonecord.git
   cd Clonecord
   ```

2. Set up the TypeScript config (gitignored because it breaks Vencord's build):
   ```bash
   cp tsconfig.template.json tsconfig.json
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

You're ready to go!

## Development

The `stubs/` directory provides type definitions for Vencord's internal APIs, so you get full autocompletion without the full Vencord source tree.

### Available Scripts

| Command | What it does |
|---------|-------------|
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Check for lint errors |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run format` | Auto-format with Prettier |
| `npm run format:check` | Check formatting |
| `npm run check` | Run everything (typecheck + lint + format + tests) |

### Testing in Discord

1. Clone this repo into `path/to/Vencord/src/userplugins/Clonecord`
2. Run `pnpm build` in the Vencord directory
3. Run `pnpm inject` in the Vencord directory

> **Important:** Do NOT commit `tsconfig.json` — it overrides Vencord's module resolution and breaks `pnpm build`.

## Guidelines

- Keep changes focused and minimal
- Follow the existing code style
- Test your changes before submitting
- Write clear commit messages
- One feature or fix per pull request

## Pull Requests

1. Ensure `npm run check` passes (typecheck + lint + format + tests)
2. Test your changes in Discord
3. Update documentation if needed
4. Submit your pull request with a clear description of what changed and why

## Reporting Issues

Use the [Issue Templates](https://github.com/zpt0/Clonecord/issues/new/choose) when reporting bugs or requesting features.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

---

Thanks for helping make Clonecord better. Seriously. ❤️
