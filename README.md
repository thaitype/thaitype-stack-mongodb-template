# Todo App Template - Next.js Enterprise Stack

A production-ready **Todo Application Template** built with Next.js 16, implementing enterprise-grade patterns and modern development practices. This template serves as a robust foundation for building scalable full-stack applications with authentication, CRUD operations, and real-time updates.

## ✨ Features

- 🔐 **Authentication System** - Better Auth with email/password
- 📝 **Todo Management** - Full CRUD operations with real-time updates  
- 🎨 **Modern UI** - Mantine components with responsive design
- 🏗️ **Enterprise Architecture** - Entity-based repository pattern
- 🔒 **Type Safety** - Full TypeScript with tRPC API layer
- 📊 **Database** - MongoDB with audit logging via Monguard
- ⚡ **Performance** - Next.js 16 with App Router and React 19
- 🎯 **Production Ready** - ESLint, Prettier, structured logging

## Screenshot
![](./docs/screenshot.png)

## 🚀 Tech Stack

### Core Framework
- **[Next.js 16](https://nextjs.org)** - React framework with App Router
- **[React 19](https://react.dev)** - Latest React with concurrent features
- **[TypeScript](https://typescriptlang.org)** - Strict type safety

### Backend & API
- **[tRPC](https://trpc.io)** - End-to-end typesafe APIs
- **[MongoDB](https://mongodb.com)** - Document database
- **[Monguard](https://github.com/thaitype/monguard)** - MongoDB wrapper with audit logging
- **[Better Auth](https://www.better-auth.com)** - Modern authentication library
- **[Zod](https://zod.dev)** - TypeScript-first schema validation

### Frontend & UI
- **[Mantine](https://mantine.dev)** - React components library
- **[Tailwind CSS](https://tailwindcss.com)** - Utility-first CSS framework
- **[@tabler/icons-react](https://tabler-icons.io)** - Icon library

### Development Tools
- **[ESLint](https://eslint.org)** - Code linting
- **[Prettier](https://prettier.io)** - Code formatting  
- **[Pino](https://getpino.io)** - Structured logging
- **[OpenTelemetry](https://opentelemetry.io)** - Observability

## 🏗️ Architecture

This template implements an **Entity-Based Repository Architecture** with strict separation of concerns:

```
src/
├── app/                    # Next.js App Router
│   ├── _components/        # UI components
│   ├── api/trpc/          # tRPC API routes  
│   └── (auth pages)       # Login, register, profile
├── server/
│   ├── api/               # tRPC routers and procedures
│   ├── domain/            # Business domain layer
│   │   ├── models/        # Domain interfaces (string IDs)
│   │   └── repositories/  # Repository interfaces
│   ├── infrastructure/    # Data access layer
│   │   ├── entities/      # Database entities (ObjectIds)
│   │   └── repositories/  # Repository implementations
│   ├── services/          # Business logic (database-agnostic)
│   └── lib/               # Shared utilities
└── trpc/                  # Client-side tRPC setup
```

### Key Patterns
- **Entity-First Design**: All types derive from database entities
- **Domain-Driven Services**: Business logic with string-based IDs  
- **Type-Safe Validation**: Zod schemas with `matches<T>()` utility
- **Audit Logging**: Automatic change tracking via Monguard
- **Structured Logging**: Request tracing and error context

## 🚦 Quick Start

### Prerequisites
- **Node.js 18+** 
- **pnpm** (recommended) or npm
- **MongoDB** instance (local or MongoDB Atlas)

### 1. Clone and Install
```bash
git clone <repository-url> my-todo-app
cd my-todo-app
pnpm install
```

### 2. Environment Setup
```bash
cp .env.example .env
```

Configure your `.env` file:
```env
# Database
MONGODB_URI="mongodb://localhost:27017"
DB_NAME="todo_app"

# Authentication
BETTER_AUTH_SECRET="your-secret-key-here"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000/api/auth"

# App Configuration  
NODE_ENV="development"
PORT="3000"
```

### 3. Start Development
```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your app!

## 📋 Development Commands

```bash
# Development
pnpm dev              # Start development server with Turbo
pnpm build            # Build for production
pnpm start            # Start production server
pnpm preview          # Build and start production server

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint errors
pnpm typecheck        # Run TypeScript check
pnpm check            # Run lint + typecheck together

# Formatting
pnpm format:check     # Check Prettier formatting
pnpm format:write     # Apply Prettier formatting
```

## 🏛️ Design Patterns

This template follows enterprise-grade design patterns documented in [`docs/entity-architecture.md`](docs/entity-architecture.md).

### Core Principles

1. **Single Source of Truth** - Types derive from database entities
2. **Dedicated Methods** - Explicit operations over generic CRUD
3. **Repository Validation** - Single validation point at data boundary
4. **Service Abstraction** - Database-agnostic business logic

### Example: Todo Repository Pattern

```typescript
// Domain Model (strings)
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  userId: string;
}

// Database Entity (ObjectIds)  
interface DbTodoEntity {
  _id: ObjectId;
  title: string;
  completed: boolean;
  userId: ObjectId;
}

// Repository Interface (domain types)
interface ITodoRepository {
  create(input: TodoCreateData, context: RepositoryContext): Promise<Todo>;
  updateContent(id: string, input: TodoContentUpdate, userId: string): Promise<void>;
  updateStatus(id: string, input: TodoStatusUpdate, userId: string): Promise<void>;
}

// Service Layer (business logic)
class TodoService {
  async createTodo(userId: string, request: CreateTodoRequest): Promise<Todo> {
    // Business validation and logic
    const context = createRepositoryContext(userId);
    return this.todoRepository.create(request, context);
  }
}
```

## 🔐 Authentication

Built-in authentication system with **Better Auth**:

- **Email/Password** authentication
- **Session Management** with secure cookies
- **Protected Routes** with middleware
- **User Context** propagation throughout the app

### Usage Example
```typescript
// Client-side
import { useSession, signIn, signOut } from '~/lib/auth-client';

function MyComponent() {
  const { data: session, isPending } = useSession();
  
  if (session?.user) {
    return <div>Hello, {session.user.name}!</div>;
  }
  
  return <button onClick={() => signIn.email(credentials)}>Sign In</button>;
}
```

## 📊 Database Schema

### User Collection
```typescript
interface DbUserEntity extends AuditableDocument {
  name: string;
  email: string;
  emailVerified: boolean;
  roles: string[];
}
```

### Todo Collection
```typescript  
interface DbTodoEntity extends AuditableDocument {
  title: string;
  description?: string;
  completed: boolean;
  userId: ObjectId;
}
```

All entities include automatic audit fields via Monguard:
- `createdAt`, `updatedAt`, `deletedAt`
- `createdBy`, `updatedBy`, `deletedBy`
- Version tracking with `__v`

## 🚀 Deployment

### Production Build
```bash
pnpm build
```

### Environment Variables
Set these in your production environment:
```env
NODE_ENV="production"
MONGODB_URI="mongodb+srv://..."
BETTER_AUTH_SECRET="secure-production-secret"
NEXT_PUBLIC_BETTER_AUTH_URL="https://yourdomain.com/api/auth"
```

### Hosting Options

#### Vercel (Recommended)
```bash
pnpm dlx vercel
```

#### Railway
```bash
pnpm dlx @railway/cli deploy
```

#### Docker
```bash
docker build -t todo-app .
docker run -p 3000:3000 todo-app
```

## 🛠️ Customization

### Adding New Features

1. **Define Domain Model** in `~/server/domain/models/`
2. **Create Database Entity** in `~/server/infrastructure/entities/`
3. **Build Repository Interface** in `~/server/domain/repositories/`
4. **Implement Repository** in `~/server/infrastructure/repositories/`
5. **Create Service Layer** in `~/server/services/`
6. **Add tRPC Router** in `~/server/api/routers/`
7. **Build UI Components** in `~/app/_components/`

### Template Structure
```
├── Authentication System ✅
├── Todo CRUD Operations ✅  
├── Real-time Updates ✅
├── Responsive UI ✅
├── Production Logging ✅
├── Type Safety ✅
└── Audit Trail ✅
```

## 📚 Documentation

- **[Entity Architecture Guide](docs/entity-architecture.md)** - Repository pattern details
- **[CLAUDE.md](CLAUDE.md)** - AI development guidelines
- **[API Documentation](#)** - tRPC endpoint reference (generated)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes following the established patterns
4. Run quality checks: `pnpm check`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [T3 Stack](https://create.t3.gg/) foundation
- UI components by [Mantine](https://mantine.dev)
- Database management by [Monguard](https://github.com/thaitype/monguard)
- Authentication by [Better Auth](https://www.better-auth.com)

## Version History

* `main` — Next.js 16, Bun as package manager, Zod v4, Matine v8, better-auth 1.4 and latest dependency upgrades
* `release/v-next15` — Next.js 15, pnpm, Zod v3 (legacy stable branch)


---

**Made with ❤️ for modern web development**

*This template represents production-ready patterns and can be used as a foundation for enterprise applications.*