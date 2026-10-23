# Obstruct contributor instructions

- Work in this checkout on the dev branch unless the user requests otherwise.
- Use Bun exclusively for dependency installation, builds, tests and scripts.
- Keep bun.lock as the only dependency lockfile. Use bun install --frozen-lockfile for reproducible installs.
- Write authored scripts in TypeScript under scripts/ and execute them directly with Bun.
- main.js is a generated CommonJS plugin artifact required by Obsidian, not an authored script.
- Validate changes with bun run package and bun run test.
- Preserve vault files and restore presentation changes on plugin unload.
