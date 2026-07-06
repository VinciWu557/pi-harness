# Repository Guidelines

## Project structure

- This is a Node/TypeScript monorepo for independently installable Pi extension, skill, prompt, and theme packages.
- Edit extension code under `extensions/<package>/src/*.ts`; each package has its own `package.json`, `README.md`, `LICENSE`, and `tsconfig.json`.
- Skills live under `skills/<package>/SKILL.md`; each skill package has its own `package.json`, `README.md`, and `LICENSE`.
- Root config owns shared tooling: `package.json`, `package-lock.json`, `eslint.config.mjs`, `.prettierrc`, `vitest.config.ts`, `tsconfig.json`, and `.github/workflows/*`.
- Do not hand-edit generated dependency output such as `node_modules/`. Keep package contents aligned with each package `files` list and `pi.extensions`/`pi.skills` entry.

## Commands

Run commands from the repository root unless noted otherwise.

- Install dependencies: `npm install`
- Full verification: `npm run check`
- Run extension tests: `npm test`
- Format with Prettier: `npm run format`
- Lint with ESLint: `npm run lint`
- Typecheck all workspaces: `npm run typecheck`
- Check package boundaries: `npm run check:boundaries`
- Preview npm package contents: `npm --workspace @vinciwu557/pi-hello pack --dry-run`
- Try a local extension without installing: `pi -e ./extensions/pi-hello`

## Code style

- TypeScript uses `module`/`moduleResolution: NodeNext`, `target: ES2022`, `strict: true`, and `noEmit: true`.
- ESLint + Prettier are authoritative: tabs, 100-column line width, double quotes, and semicolons.
- Keep extension packages small and self-contained. Add dependencies only when they solve a current extension need.
- When adding an extension, include the source in `pi.extensions`, package publish `files`, and ensure it has a test file.
- When adding a skill, include the `SKILL.md` in `pi.skills` and package publish `files`.

## Testing and verification

- Extension test suites live under `extensions/<package>/test/*.test.ts` and run with `npm test` (Vitest).
- Use `npm run check` as the CI-equivalent local gate; it runs ESLint, Prettier check, boundary checks, workspace typechecks, and tests.
- For package metadata or publishing changes, also run `npm --workspace <package> pack --dry-run` and inspect the tarball contents.
- For Pi runtime behavior, prefer `pi -e ./extensions/<package>` before publishing.

## Publishing and release safety

- Packages are published via the GitHub `publish` workflow on tag push. Never commit OTPs, tokens, or npm credentials.
- Use the GitHub `bump-version` workflow to bump all package versions together and tag `v*.*.*`.
- For local version bumps without tagging: `node scripts/bump-shared-version.mjs <major|minor|patch>`.
- All packages share the same version number.

## Git and PR guidance

- Use Conventional Commits such as `feat: ...`, `fix: ...`, and `chore(release): ...`.
- Stage only intended paths. Do not use blanket staging for unrelated local changes.
- For PRs or handoff notes, include the commands run and any publish/visibility checks performed.

## Package naming conventions

| Type      | Scope                  | Example                     |
| --------- | ---------------------- | --------------------------- |
| Extension | `@vinciwu557/pi-*`     | `@vinciwu557/pi-hello`      |
| Skill     | `@vinciwu557/skill-*`  | `@vinciwu557/skill-demo`    |
| Prompt    | `@vinciwu557/prompt-*` | `@vinciwu557/prompt-coding` |
| Theme     | `@vinciwu557/theme-*`  | `@vinciwu557/theme-dark`    |

## Adding new resource types

When `prompts/` or `themes/` directories are first used:

1. Create the directory and first package under it.
2. Add the directory pattern to `workspaces` in root `package.json`.
3. Update `scripts/check-extension-boundaries.mjs` `workspaceDirectories` array.
4. Update `.github/workflows/bump-version.yml` and `publish.yml` to include the new directory in `git add` and package scanning.
