# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `bun run build` or `pbun build`
- **Development**: `bun run dev` or `pbun dev` (with Turbo)
- **Lint**: `bun run lint` (run lint check)
- **Lint Fix**: `bun run lint:fix` (auto-fix lint issues)
- **Type Check**: `bun run typecheck` or `bun run check` (includes lint + typecheck)
- **Format Check**: `bun run format:check` (check Prettier formatting)
- **Format Write**: `bun run format:write` (auto-format code)
- **Preview**: `bun run preview` (build and start)
- **Package Manager**: Uses pbun (see `package.json` packageManager field)
- **Check All**: `bun run all` (lint, typecheck, format check)

## Architecture Overview

This is a Next.js 16 application built with the T3 Stack pattern, implementing a clean entity-based repository architecture.

### Tech Stack
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Database**: MongoDB with Monguard for audit logging
- **API**: tRPC for type-safe APIs
- **Authentication**: Better Auth
- **Validation**: Zod schemas
- **Logging**: Pino logger
- **Observability**: OpenTelemetry instrumentation
- **UI**: React 19 with Tailwind CSS

### Key Architectural Patterns

#### Entity-Based Repository Pattern
The codebase implements a sophisticated entity-based repository architecture with strict separation of concerns:

**Service Layer (Database-Agnostic)**:
- Located in `src/server/services/`
- Works exclusively with domain types (strings)
- Contains business logic and permission checking
- NEVER imports or uses MongoDB ObjectId
- Passes string IDs to repository methods

**Repository Layer (Database-Specific)**:
- Located in `src/server/infrastructure/repositories/`
- Implements `src/server/domain/repositories/` interfaces
- Handles string-to-ObjectId conversion via Zod schemas
- Contains all MongoDB-specific operations
- Extends `BaseMongoRepository` for common functionality

**Domain Models**:
- `src/server/domain/models/` - Domain interfaces (strings)
- `src/server/infrastructure/entities/` - Database entities (ObjectIds)

#### Type Safety Strategy
- All repository types derive from database entities using TypeScript utility types
- Dedicated methods instead of generic update operations
- Runtime validation with Zod schemas that auto-convert strings to ObjectIds
- Schema-type alignment using `matches<T>()` utility

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── _components/        # UI components
│   ├── api/trpc/          # tRPC API routes
│   └── layout.tsx, page.tsx
├── server/
│   ├── api/               # tRPC routers and procedures
│   ├── config/            # Environment and type configs
│   ├── context/           # Application context
│   ├── domain/            # Business domain layer
│   │   ├── models/        # Domain interfaces (strings)
│   │   └── repositories/  # Repository interfaces
│   ├── infrastructure/    # Data access layer
│   │   ├── entities/      # Database entities (ObjectIds)
│   │   ├── repositories/  # Repository implementations
│   │   └── logging/       # Logger implementations
│   ├── lib/               # Shared utilities
│   │   ├── auth-api.ts    # Authentication helpers
│   │   ├── db.ts          # Database connection
│   │   ├── validation/    # Zod utilities
│   │   └── errors/        # Domain error definitions
│   ├── middleware/        # Authentication and tracing
│   ├── routes/            # Route handlers
│   ├── schemas/           # API validation schemas
│   ├── services/          # Business logic (database-agnostic)
│   └── types/             # Type definitions
└── trpc/                  # Client-side tRPC setup
```

### Important Development Rules

#### Repository Pattern Rules
1. **Service Layer Database Independence**: Services MUST work with domain types (strings), never ObjectId
2. **No MongoDB in Services**: NEVER import or use `ObjectId` from 'mongodb' in service layer
3. **Repository Interface Types**: Repository interfaces accept domain types, implementations handle conversion
4. **Dedicated Methods**: Use specific methods like `updateBasicInfo()` instead of generic `update()`
5. **Schema Validation**: All repository inputs validated with Zod schemas using `matches<T>()`

#### Type Derivation Rules
- Database entities are single source of truth in `~/infrastructure/entities`
- Repository types MUST derive from entities using utility types: `Omit<>`, `Pick<>`, `Partial<>`
- Use naming convention: `EntityCreateData`, `EntityFieldUpdate`, `EntityFieldPartialUpdate`
- Prefix database entities with `Db` (e.g., `DbUserEntity`)

#### Error Handling
- Repository operations wrapped in try-catch with structured logging
- Use domain-specific errors from `~/server/lib/errors/domain-errors`
- Include operation context in all log statements

### Authentication & Context
- Uses Better Auth for authentication
- Repository operations require `RepositoryContext` with `operatedBy` field
- Monguard provides automatic audit logging for data changes
- User context resolution handled in `BaseMongoRepository`

### Logging & Observability
- Pino logger with structured logging throughout
- OpenTelemetry auto-instrumentation enabled
- Audit logging via Monguard with delta tracking
- Log levels: error, warn, info with operation context

Refer to `docs/entity-architecture.md` for comprehensive details on the repository pattern implementation.