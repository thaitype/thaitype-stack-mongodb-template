# Design Patterns & Development Guidelines

This document provides comprehensive guidelines for the design patterns, architectural decisions, and development practices used in this Todo App Template. These patterns ensure type safety, maintainability, and scalability across the entire application.

## Table of Contents

1. [Entity-Based Repository Pattern](#entity-based-repository-pattern)
2. [Service Layer Patterns](#service-layer-patterns)
3. [Validation Architecture](#validation-architecture)
4. [tRPC Integration Patterns](#trpc-integration-patterns)
5. [UI Component Patterns](#ui-component-patterns)
6. [Authentication Patterns](#authentication-patterns)
7. [Best Practices](#best-practices)
8. [Anti-Patterns & Common Mistakes](#anti-patterns--common-mistakes)

---

## Entity-Based Repository Pattern

### Core Philosophy

The **Entity-Based Repository Pattern** establishes database entities as the single source of truth for all type definitions. This prevents type drift and ensures consistency across the application layers.

### 1. Database Entity Definition

Database entities are defined in `~/server/infrastructure/entities/` and serve as the foundation for all derived types:

```typescript
// ~/server/infrastructure/entities/index.ts
import { AuditableDocument } from 'monguard';
import { ObjectId } from 'mongodb';

export interface DbTodoEntity extends AuditableDocument {
  _id: ObjectId;
  title: string;
  description?: string;
  completed: boolean;
  userId: ObjectId;
  // Inherited from AuditableDocument:
  // createdAt: Date;
  // updatedAt: Date;
  // deletedAt?: Date;
  // createdBy?: ObjectId;
  // updatedBy?: ObjectId;
  // deletedBy?: ObjectId;
  // __v?: number;
}
```

### 2. Domain Model Definition

Domain models in `~/server/domain/models/` represent the business layer view with string-based IDs:

```typescript
// ~/server/domain/models/todo.ts
export interface Todo {
  id: string;              // Converted from ObjectId
  title: string;
  description?: string;
  completed: boolean;
  userId: string;          // Converted from ObjectId
  createdAt: Date;
  updatedAt: Date;
}
```

### 3. Repository Type Derivation

All repository types **MUST** derive from database entities using TypeScript utility types:

```typescript
// ~/server/domain/repositories/schemas/todo-repository-schemas.ts
import type { DbTodoEntity } from '~/server/infrastructure/entities';

// ✅ CORRECT: Derive from database entity
export type RepoTodoCreateData = Omit<
  DbTodoEntity, 
  '_id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdBy' | 'updatedBy' | 'deletedBy' | '__v'
>;

export type RepoTodoContentUpdate = Pick<DbTodoEntity, 'title' | 'description'>;
export type RepoTodoStatusUpdate = Pick<DbTodoEntity, 'completed'>;

// ❌ FORBIDDEN: Manual type definitions
interface TodoCreateData {
  title: string;        // Could drift from DbTodoEntity
  description: string;  // Could become out of sync
}
```

### 4. Repository Interface Design

Repository interfaces define domain-focused methods with explicit naming:

```typescript
// ~/server/domain/repositories/todo-repository.ts
import type { RepositoryContext } from '~/server/lib/constants';

export interface ITodoRepository {
  // Explicit, dedicated methods instead of generic CRUD
  create(input: RepoTodoCreateData, context: RepositoryContext): Promise<Todo>;
  findById(id: string, userId?: string): Promise<Todo | null>;
  findByUserId(userId: string, options?: TodoQueryOptions): Promise<Todo[]>;
  
  // Dedicated update methods for different concerns
  updateContent(id: string, input: RepoTodoContentUpdate, userId: string, context: RepositoryContext): Promise<void>;
  updateStatus(id: string, input: RepoTodoStatusUpdate, userId: string, context: RepositoryContext): Promise<void>;
  
  // Specialized operations
  toggleCompletion(id: string, userId: string, context: RepositoryContext): Promise<Todo>;
  delete(id: string, userId: string, context: RepositoryContext): Promise<void>;
  countByUserId(userId: string, filter?: { completed?: boolean }): Promise<number>;
}
```

### 5. Repository Implementation

Repository implementations handle ObjectId conversion and validation:

```typescript
// ~/server/infrastructure/repositories/mongo-todo-repository.ts
export class MongoTodoRepository extends BaseMongoRepository implements ITodoRepository {
  private collection: MonguardCollection<DbTodoEntity>;

  async create(input: RepoTodoCreateData, context: RepositoryContext): Promise<Todo> {
    try {
      // Validate input with Zod schema
      const validatedInput = RepoTodoCreateSchema.parse(input);
      
      // Create document with Monguard (includes audit fields)
      const createdTodo = await this.collection.create(validatedInput, {
        userContext: this.resolveUserContext(context)
      });

      // Convert ObjectId to string for domain model
      return this.mapToDomainModel(createdTodo);
    } catch (error) {
      this.logger.error('Failed to create todo', { error, input, context });
      throw error;
    }
  }

  private mapToDomainModel(entity: DbTodoEntity): Todo {
    return {
      id: (entity._id as ObjectId).toString(),
      title: entity.title,
      description: entity.description,
      completed: entity.completed,
      userId: (entity.userId as ObjectId).toString(),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
```

---

## Service Layer Patterns

### Database-Agnostic Business Logic

Service layer contains business logic and **NEVER** imports MongoDB types directly:

```typescript
// ~/server/services/todo-service.ts
import type { AppContext } from '~/server/context/app-context';
import type { ITodoRepository, Todo } from '~/server/domain';
import { createRepositoryContext } from '~/server/lib/constants';

export class TodoService {
  constructor(
    private appContext: AppContext,
    private todoRepository: ITodoRepository
  ) {}

  async createTodo(userId: string, request: CreateTodoRequest): Promise<Todo> {
    try {
      // Business validation
      if (!request.title.trim()) {
        throw new ValidationError('Title is required');
      }

      if (request.title.length > 200) {
        throw new ValidationError('Title too long', {
          maxLength: 200,
          currentLength: request.title.length
        });
      }

      // Create repository context
      const context = createRepositoryContext(userId);
      
      // Delegate to repository
      const todo = await this.todoRepository.create({
        title: request.title.trim(),
        description: request.description?.trim(),
        completed: false,
        userId
      }, context);

      this.appContext.logger.info('Todo created successfully', {
        todoId: todo.id,
        userId
      });

      return todo;
    } catch (error) {
      this.appContext.logger.error('Failed to create todo', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        request
      });
      throw error;
    }
  }
}
```

### Context Propagation Pattern

Use `RepositoryContext` for user tracking and audit logging:

```typescript
// ~/server/lib/constants.ts
export interface RepositoryContext {
  operatedBy: string;
  traceId?: string;
}

export function createRepositoryContext(userId: string, traceId?: string): RepositoryContext {
  return {
    operatedBy: userId,
    traceId
  };
}
```

---

## Validation Architecture

### Zod Schema with Type Alignment (Zod v4)

Use the `matches<T>()` utility to ensure Zod schemas align with TypeScript types:

```typescript
// ~/server/domain/repositories/schemas/todo-repository-schemas.ts
import { matches } from '~/server/lib/validation/zod-utils';
import { z } from 'zod';
import { zObjectId, commonValidation } from '~/server/lib/validation/zod-utils';

// Type definitions derived from entity
export type RepoTodoCreateData = Omit<DbTodoEntity, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

// Schema that matches the type exactly (Zod v4)
export const RepoTodoCreateSchema = matches<RepoTodoCreateData>()(
  z.object({
    title: commonValidation.nonEmptyString.max(200),
    description: z.string().max(1000).optional(),
    completed: z.boolean().default(false),
    userId: zObjectId,
  })
);

// Compile-time type checking ensures schema matches type
const _typeCheck: RepoTodoCreateData = {} as z.infer<typeof RepoTodoCreateSchema>;
```

### Common Validation Utilities (Zod v4)

```typescript
// ~/server/lib/validation/zod-utils.ts
import { z } from 'zod';
import { ObjectId } from 'mongodb';

// Zod v4 compatible ObjectId validator and transformer
export const zObjectId = z
  .string()
  .refine((val) => ObjectId.isValid(val), {
    message: 'Invalid ObjectId format. Expected 24-character hex string.'
  })
  .transform((val) => new ObjectId(val));

// Optional ObjectId transformer
export const zObjectIdOptional = z
  .string()
  .optional()
  .refine((val) => val === undefined || ObjectId.isValid(val), {
    message: 'Invalid ObjectId format. Expected 24-character hex string or undefined.'
  })
  .transform((val) => val ? new ObjectId(val) : undefined);

export const commonValidation = {
  nonEmptyString: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email format'),
  objectId: zObjectId,
};
```

### Zod v4 Breaking Changes

**Important**: This project uses Zod v4. Key differences from v3:

1. **`z.record()` requires 2 arguments**: `z.record(keySchema, valueSchema)`
2. **Error property**: Use `error.issues` instead of `error.errors`
3. **Nested defaults**: Parent defaults must include child defaults
4. **Type parameters**: Use `any` instead of `ZodTypeDef` in generics

---

## tRPC Integration Patterns

### Router Structure

Organize tRPC routers by feature with consistent error handling:

```typescript
// ~/server/api/routers/todo.ts
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { TRPCError } from '@trpc/server';

export const todoRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const todo = await ctx.todoService.createTodo(userId, input);

        return {
          success: true,
          todo
        };
      } catch (error) {
        ctx.logger.error('Failed to create todo', { error, input });

        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create todo'
        });
      }
    }),

  getAll: protectedProcedure
    .input(z.object({
      includeCompleted: z.boolean().optional().default(true),
      limit: z.number().min(1).max(100).optional(),
      skip: z.number().min(0).optional(),
    }).optional().default({ includeCompleted: true }))  // Zod v4: nested defaults
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const todos = await ctx.todoService.getTodos(userId, input);

      return {
        todos,
        total: todos.length
      };
    }),
});
```

### Client-Side Integration

Use tRPC hooks with proper error handling and optimistic updates:

```typescript
// ~/app/_components/TodoList.tsx
import { api } from '~/trpc/react';

export function TodoList() {
  const utils = api.useUtils();
  
  const { 
    data: todosData, 
    isLoading, 
    error 
  } = api.todo.getAll.useQuery({
    includeCompleted: true,
  });

  const createMutation = api.todo.create.useMutation({
    onSuccess: () => {
      // Invalidate queries for real-time updates
      void utils.todo.getAll.invalidate();
      void utils.todo.getStats.invalidate();
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  const handleCreate = (input: CreateTodoInput) => {
    createMutation.mutate(input);
  };

  // ... rest of component
}
```

---

## UI Component Patterns

### Mantine Component Composition

Build responsive components with Mantine's design system:

```typescript
// ~/app/_components/TodoItem.tsx
import {
  Card,
  Text,
  Checkbox,
  Group,
  ActionIcon,
  Menu,
  Stack,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconDots, IconEdit, IconTrash } from '@tabler/icons-react';

interface TodoItemProps {
  todo: Todo;
  onUpdate?: () => void;
}

export function TodoItem({ todo, onUpdate }: TodoItemProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const utils = api.useUtils();

  const toggleMutation = api.todo.toggle.useMutation({
    onSuccess: () => {
      void utils.todo.getAll.invalidate();
      void utils.todo.getStats.invalidate();
      onUpdate?.();
    },
  });

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" style={{ flex: 1 }}>
          <Checkbox
            checked={todo.completed}
            onChange={() => toggleMutation.mutate({ id: todo.id })}
          />
          <Stack gap={2} style={{ flex: 1 }}>
            <Text
              fw={500}
              td={todo.completed ? 'line-through' : undefined}
              c={todo.completed ? 'dimmed' : undefined}
            >
              {todo.title}
            </Text>
            {todo.description && (
              <Text size="sm" c="dimmed">
                {todo.description}
              </Text>
            )}
          </Stack>
        </Group>

        {!isMobile && (
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDots size="1rem" />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconEdit size="0.9rem" />}>
                Edit
              </Menu.Item>
              <Menu.Item 
                leftSection={<IconTrash size="0.9rem" />}
                color="red"
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
    </Card>
  );
}
```

### Responsive Design Patterns

```typescript
// Responsive hook usage
const isMobile = useMediaQuery('(max-width: 768px)');
const isTablet = useMediaQuery('(max-width: 1024px)');

// Conditional rendering based on screen size
return (
  <SegmentedControl
    size={isMobile ? "xs" : "sm"}
    fullWidth={isMobile}
    data={segments}
  />
);
```

### Form Validation Patterns (Zod v4)

```typescript
// ~/app/_components/AddTodoForm.tsx
import { useForm } from '@mantine/form';
import { z } from 'zod';

const todoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
});

export function AddTodoForm() {
  const form = useForm({
    initialValues: {
      title: '',
      description: '',
    },
    validate: {
      title: (value) => {
        try {
          todoSchema.pick({ title: true }).parse({ title: value });
          return null;
        } catch (error) {
          // Zod v4: Use error.issues instead of error.errors
          if (error instanceof z.ZodError) {
            return error.issues[0]?.message ?? 'Invalid title';
          }
          return 'Invalid title';
        }
      },
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    // Form is already validated
    createMutation.mutate(values);
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <TextInput
        label="Title"
        placeholder="What needs to be done?"
        required
        {...form.getInputProps('title')}
      />
      <Textarea
        label="Description"
        placeholder="Additional details..."
        {...form.getInputProps('description')}
      />
      <Button type="submit" loading={createMutation.isPending}>
        Add Todo
      </Button>
    </form>
  );
}
```

---

## Authentication Patterns

### Session Management

```typescript
// ~/lib/auth-client.ts - Client-side auth
import { useQuery } from '@tanstack/react-query';
import { authClient } from './auth-client-setup';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => authClient.getSession(),
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export const { signIn, signOut, signUp } = authClient;
```

### Protected Route Pattern

```typescript
// ~/server/api/trpc.ts
import { TRPCError } from '@trpc/server';

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action',
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});
```

### User Context Propagation

```typescript
// Service layer receives user context
export class TodoService {
  async createTodo(userId: string, request: CreateTodoRequest): Promise<Todo> {
    // userId comes from authenticated session
    const context = createRepositoryContext(userId);
    return this.todoRepository.create(request, context);
  }
}
```

---

## Best Practices

### 1. Naming Conventions

```typescript
// Interfaces
interface ITodoRepository { }        // Repository interfaces with 'I' prefix
interface Todo { }                   // Domain models
interface DbTodoEntity { }           // Database entities with 'Db' prefix

// Types
type RepoTodoCreateData = ...;       // Repository types with 'Repo' prefix
type CreateTodoRequest = ...;        // Service layer request types
type TodoQueryOptions = ...;         // Query option types

// Classes
class TodoService { }                // Services with 'Service' suffix
class MongoTodoRepository { }        // Repository implementations

// Functions
function createRepositoryContext()   // Factory functions with 'create' prefix
function mapToDomainModel()          // Mapper functions with 'mapTo' prefix
```

### 2. Import Organization

```typescript
// 1. Node modules
import { ObjectId } from 'mongodb';
import { z } from 'zod';

// 2. Internal types and interfaces
import type { AppContext } from '~/server/context/app-context';
import type { ITodoRepository, Todo } from '~/server/domain';

// 3. Internal utilities and constants
import { createRepositoryContext } from '~/server/lib/constants';
import * as Err from '~/server/lib/errors/domain-errors';

// 4. Implementation imports
import { MongoTodoRepository } from '~/server/infrastructure/repositories';
```

### 3. Error Handling Patterns

```typescript
// Domain-specific errors
export class ValidationError extends Error {
  constructor(message: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Service layer error handling
try {
  const result = await this.repository.operation();
  return result;
} catch (error) {
  this.logger.error('Operation failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    context: { userId, operationType: 'create' }
  });
  throw error; // Re-throw to maintain error type
}
```

### 4. Logging Patterns

```typescript
// Structured logging with context
this.logger.info('Todo created successfully', {
  todoId: todo.id,
  userId,
  operation: 'createTodo',
  service: 'TodoService'
});

this.logger.error('Failed to create todo', {
  error: error instanceof Error ? error.message : 'Unknown error',
  userId,
  title: request.title,
  operation: 'createTodo',
  service: 'TodoService'
});
```

---

## Anti-Patterns & Common Mistakes

### ❌ 1. Manual Type Definitions

```typescript
// ❌ DON'T: Define types manually
interface TodoCreateData {
  title: string;
  description: string; // Could become out of sync with entity
}

// ✅ DO: Derive from database entity
type TodoCreateData = Omit<DbTodoEntity, '_id' | 'createdAt' | 'updatedAt'>;
```

### ❌ 2. Generic Repository Methods

```typescript
// ❌ DON'T: Use generic update methods
interface ITodoRepository {
  update(id: string, data: Partial<Todo>): Promise<void>;
}

// ✅ DO: Use dedicated, explicit methods
interface ITodoRepository {
  updateContent(id: string, input: TodoContentUpdate): Promise<void>;
  updateStatus(id: string, input: TodoStatusUpdate): Promise<void>;
}
```

### ❌ 3. MongoDB Types in Service Layer

```typescript
// ❌ DON'T: Import MongoDB types in services
import { ObjectId } from 'mongodb';

export class TodoService {
  async findById(id: ObjectId): Promise<Todo> { } // Wrong!
}

// ✅ DO: Use string IDs in service layer
export class TodoService {
  async findById(id: string): Promise<Todo> { } // Correct!
}
```

### ❌ 4. Unvalidated Repository Inputs

```typescript
// ❌ DON'T: Skip validation in repository
async create(input: unknown): Promise<Todo> {
  return this.collection.create(input); // Dangerous!
}

// ✅ DO: Validate with Zod schemas (Zod v4)
async create(input: RepoTodoCreateData): Promise<Todo> {
  const validatedInput = RepoTodoCreateSchema.parse(input);
  return this.collection.create(validatedInput);
}
```

### ❌ 7. Zod v3 Patterns in v4 Codebase

```typescript
// ❌ DON'T: Use Zod v3 patterns
const schema = z.object({
  metadata: z.record(z.string()).optional(),  // Missing key schema!
});

// Error handling with v3 API
catch (error) {
  return error.errors[0]?.message;  // Use .issues in v4!
}

// Nested defaults without parent match
z.object({
  field: z.boolean().default(true)
}).optional().default({})  // Empty object won't work!

// ✅ DO: Use Zod v4 patterns
const schema = z.object({
  metadata: z.record(z.string(), z.string()).optional(),  // Two arguments
});

// Error handling with v4 API
catch (error) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message;  // Use .issues
  }
}

// Nested defaults with parent match
z.object({
  field: z.boolean().optional().default(true)
}).optional().default({ field: true })  // Parent includes child default
```

### ❌ 5. Missing Error Context

```typescript
// ❌ DON'T: Generic error handling
try {
  // operation
} catch (error) {
  throw error; // No context!
}

// ✅ DO: Add structured context
try {
  // operation  
} catch (error) {
  this.logger.error('Operation failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    operation: 'createTodo',
    userId,
    context: input
  });
  throw error;
}
```

### ❌ 6. Direct MongoDB Operations in Services

```typescript
// ❌ DON'T: Direct MongoDB operations in services
export class TodoService {
  async createTodo(userId: string, input: CreateTodoRequest): Promise<Todo> {
    const result = await this.db.collection('todos').insertOne(input); // Wrong layer!
    return result;
  }
}

// ✅ DO: Use repository abstraction
export class TodoService {
  async createTodo(userId: string, input: CreateTodoRequest): Promise<Todo> {
    const context = createRepositoryContext(userId);
    return this.todoRepository.create(input, context); // Correct!
  }
}
```

---

## Migration Guide

### From Generic Repository to Entity-Based

1. **Define Database Entity**:
```typescript
// Before: Scattered type definitions
interface Todo { id: string; title: string; }
interface CreateTodo { title: string; }

// After: Single source of truth
interface DbTodoEntity extends AuditableDocument {
  _id: ObjectId;
  title: string;
  description?: string;
  completed: boolean;
  userId: ObjectId;
}
```

2. **Create Derived Types**:
```typescript
// Derive all repository types from entity
type RepoTodoCreateData = Omit<DbTodoEntity, '_id' | 'createdAt' | 'updatedAt'>;
type RepoTodoUpdateData = Partial<Pick<DbTodoEntity, 'title' | 'description' | 'completed'>>;
```

3. **Replace Generic Methods**:
```typescript
// Before: Generic methods
update(id: string, data: Partial<Todo>): Promise<void>

// After: Dedicated methods
updateContent(id: string, input: TodoContentUpdate): Promise<void>
updateStatus(id: string, input: TodoStatusUpdate): Promise<void>
```

4. **Add Validation**:
```typescript
// Add Zod schemas with matches<T>() utility (Zod v4)
export const RepoTodoCreateSchema = matches<RepoTodoCreateData>()(
  z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    completed: z.boolean().default(false),
    userId: zObjectId,
  })
);
```

---

## Zod v4 Migration Guide

This project uses **Zod v4**, which includes breaking changes from v3. This section helps you work with Zod v4 correctly.

### Breaking Changes Summary

| Change | Zod v3 | Zod v4 |
|--------|--------|--------|
| `z.record()` | Single argument | Requires 2 arguments |
| Error property | `error.errors` | `error.issues` |
| Nested defaults | Empty object OK | Must match child defaults |
| Type parameters | `ZodTypeDef` | Use `any` |

### 1. `z.record()` Syntax

```typescript
// ❌ Zod v3
const UserFilterQuerySchema = z.object({
  sort: z.record(z.enum(['1', '-1'])).optional(),
  metadata: z.record(z.string()).optional(),
});

// ✅ Zod v4
const UserFilterQuerySchema = z.object({
  sort: z.record(z.string(), z.enum(['1', '-1'])).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});
```

### 2. Error Handling

```typescript
// ❌ Zod v3
export function formatZodError(error: z.ZodError): string {
  const messages = error.errors.map(err => {
    return `${err.path.join('.')}: ${err.message}`;
  });
  return messages.join('; ');
}

// ✅ Zod v4
export function formatZodError(error: z.ZodError): string {
  const messages = error.issues.map(err => {
    return `${err.path.join('.')}: ${err.message}`;
  });
  return messages.join('; ');
}
```

### 3. Nested Defaults

```typescript
// ❌ Zod v3 - This worked
.input(z.object({
  includeCompleted: z.boolean().optional().default(true),
  limit: z.number().optional(),
}).optional().default({}))  // Empty object

// ✅ Zod v4 - Parent must include child defaults
.input(z.object({
  includeCompleted: z.boolean().optional().default(true),
  limit: z.number().optional(),
}).optional().default({ includeCompleted: true }))  // Matches child default
```

### 4. Generic Type Utilities

```typescript
// ❌ Zod v3
export const matches = <T>() => <S extends z.ZodType<T, z.ZodTypeDef, unknown>>(
  schema: S
): S => schema;

// ✅ Zod v4
export const matches = <T>() => <S extends z.ZodType<T, any, any>>(
  schema: S
): S => schema;
```

### 5. ObjectId Transformers (Updated for v4)

```typescript
// Zod v4 compatible ObjectId validators
import { z } from 'zod';
import { ObjectId } from 'mongodb';

// Single ObjectId
export const zObjectId = z
  .string()
  .refine((val) => ObjectId.isValid(val), {
    message: 'Invalid ObjectId format. Expected 24-character hex string.'
  })
  .transform((val) => new ObjectId(val));

// Optional ObjectId
export const zObjectIdOptional = z
  .string()
  .optional()
  .refine((val) => val === undefined || ObjectId.isValid(val), {
    message: 'Invalid ObjectId format. Expected 24-character hex string or undefined.'
  })
  .transform((val) => val ? new ObjectId(val) : undefined);

// ObjectId Array
export const zObjectIdArray = z
  .array(z.string())
  .refine((arr) => arr.every(id => ObjectId.isValid(id)), {
    message: 'All items must be valid ObjectId format (24-character hex strings).'
  })
  .transform((arr) => arr.map(id => new ObjectId(id)));
```

### Common v4 Patterns

#### tRPC Input with Optional Object

```typescript
// Pattern for optional input objects with defaults
getAll: protectedProcedure
  .input(z.object({
    includeCompleted: z.boolean().optional().default(true),
    limit: z.number().min(1).max(100).optional(),
    skip: z.number().min(0).optional(),
  }).optional().default({ includeCompleted: true }))
  .query(async ({ ctx, input }) => {
    // input.includeCompleted is guaranteed to be true if not provided
  });
```

#### Query Schemas with Record Types

```typescript
// Pattern for query schemas with sorting/filtering
export const TodoQuerySchema = z.object({
  userId: z.string().min(24).max(24),
  includeCompleted: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional(),
  skip: z.number().min(0).optional(),
  // Record type for MongoDB sort syntax
  sort: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
});
```

#### Form Validation

```typescript
// Pattern for form validation with error handling
const handleValidation = (value: string) => {
  try {
    schema.parse(value);
    return null;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.issues[0]?.message ?? 'Validation error';
    }
    return 'Unknown error';
  }
};
```

### Migration Checklist

When adding new schemas or updating existing ones:

- [ ] Use `z.record(keySchema, valueSchema)` with 2 arguments
- [ ] Access validation errors via `error.issues` not `error.errors`
- [ ] Ensure nested defaults match parent object defaults
- [ ] Use `any` instead of `ZodTypeDef` in generic utilities
- [ ] Test schema validation with actual data
- [ ] Update error handling to use `error.issues`

---

This design pattern documentation ensures consistency, type safety, and maintainability across the entire application. Following these patterns will result in a robust, scalable codebase that's easy to understand and extend.