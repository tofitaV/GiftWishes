# Repository Guidelines

## Project Structure & Module Organization

This is an npm workspace monorepo for the Gift Wishes Telegram Mini App.

- `apps/web`: Next.js + React frontend. App routes live in `src/app`, reusable UI in `src/components`, browser helpers/tests in `src/lib`.
- `apps/api`: NestJS backend and bot/API modules. Feature code is under `src/modules`, shared request helpers under `src/common`.
- `packages/shared`: shared TypeScript DTOs/constants used by web and API.
- `prisma/schema.prisma`: PostgreSQL schema and Prisma models.
- `.github/workflows/deploy-web.yml`: GitHub Pages build/deploy workflow for the web app.

Generated output such as `apps/web/out`, `apps/api/dist`, logs, and local environment files should not be edited as source.

## Build, Test, and Development Commands

Run commands from the repository root unless noted.

- `npm install`: install workspace dependencies.
- `npm run prisma:generate`: generate Prisma client from `prisma/schema.prisma`.
- `npm run prisma:migrate`: run local Prisma migrations.
- `npm run dev -w @gift-wishes/api`: build and start the backend on port `4000`.
- `npm run dev -w @gift-wishes/web`: start the Next.js dev server on `127.0.0.1:3000`.
- `npm run build`: build all workspaces that define a build script.
- `npm run test`: run workspace tests.
- `npm run typecheck`: run TypeScript checks across workspaces.

## Coding Style & Naming Conventions

Use TypeScript with ES modules. Keep imports explicit and relative paths consistent with existing files. Prefer named exports for shared helpers. Use two-space indentation in JSON and follow the surrounding TypeScript formatting style. React components use `PascalCase`; hooks/helpers use `camelCase`; test files use `*.test.ts` or `*.test.tsx`.

## Testing Guidelines

Tests use Vitest. Keep tests close to the code they cover, for example `apps/web/src/lib/api.test.ts` and `apps/api/src/common/jwt-auth.guard.test.ts`. Add focused regression tests for bug fixes before changing production behavior. Run the relevant workspace test first, then broader checks when touching shared behavior.

## Commit & Pull Request Guidelines

Recent history uses short messages like `Fix`; prefer more descriptive imperative messages for new work, such as `Fix JWT user mapping` or `Disable wallet UI temporarily`. PRs should include a short summary, test/build commands run, linked issue if applicable, and screenshots for visible frontend changes.

## Security & Configuration Tips

Do not commit `.env` or secrets. Configure public frontend values through GitHub Actions variables, especially `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_BASE_PATH`. For local ngrok testing, keep backend CORS origins and frontend API headers in sync.
