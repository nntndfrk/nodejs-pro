# nodejs-pro

A production-ready NestJS application with modular architecture, strict TypeScript configuration, and industry-standard tooling.

## Tech Stack

- **Framework:** NestJS 11
- **Language:** TypeScript 5.7 (strict mode)
- **Runtime:** Node.js 24
- **Linting:** ESLint 9 (strictTypeChecked + stylisticTypeChecked)
- **Formatting:** Prettier 3
- **Testing:** Jest 30
- **Git Hooks:** Husky 9

## Project Architecture

```
src/
├── config/                    # Application configuration
│   ├── app.config.ts          # Typed config with registerAs namespace
│   ├── env.validation.ts      # Environment validation & defaults
│   └── index.ts
├── modules/                   # Feature modules
│   └── users/                 # Example module
│       ├── users.module.ts
│       └── index.ts
├── app.module.ts              # Root module
├── app.controller.ts          # Root controller
├── app.service.ts             # Root service
└── main.ts                    # Application entry point
```

## Why This Structure?

### Modular Architecture

Each feature is encapsulated in its own module under `src/modules/`. This approach:

- **Enables team scalability** — different teams can own different modules
- **Supports future microservices migration** — modules can be extracted into separate services
- **Improves code organization** — related code stays together

### Centralized Configuration

All environment configuration is managed in `src/config/`:

- **Single source of truth** — `ENV_DEFAULTS` defines all default values
- **Validation on startup** — Invalid env vars fail fast with clear errors
- **Type-safe access** — `ConfigService.get<AppConfig>('app')` provides typed config

### Strict TypeScript & ESLint

The strictest possible configuration catches bugs at compile time:

- `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- ESLint `strictTypeChecked` + `stylisticTypeChecked`
- Relaxed rules only for tests and migrations

## Getting Started

### Prerequisites

- Node.js 24+
- npm 10+

### Installation

```bash
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### Running the Application

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start in watch mode |
| `npm run start:prod` | Start production build |
| `npm run build` | Build the application |
| `npm run lint` | Lint and auto-fix |
| `npm run format` | Format with Prettier |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run e2e tests |
| `npm run test:cov` | Run tests with coverage |

## Git Hooks

Husky enforces code quality:

- **Pre-commit:** `npm run format` + `npm run lint`
- **Pre-push:** `npm run test` + `npm run build`

## Configuration

Environment variables are validated on startup. See `.env.example` for available options:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment (`development`, `production`, `test`) |
| `PORT` | `3000` | Server port |
| `APP_NAME` | `nodejs-pro` | Application name |

## License

UNLICENSED
