# Repository Design Pattern - Entity-Based Architecture

## Overview

Next js API implements an **Entity-Based Repository Architecture** that prioritizes type safety, clear interfaces, and separation of concerns. This pattern replaces traditional generic repository approaches with dedicated, strongly-typed methods that align directly with database entity structures.

## Table of Contents

- [Core Principles](#core-principles)
- [Entity-Based Type System](#entity-based-type-system)
- [Validation Architecture](#validation-architecture)
- [Implementation Patterns](#implementation-patterns)
- [Service Integration](#service-integration)
- [Migration Guide](#migration-guide)
- [Best Practices](#best-practices)

## Core Principles

### 1. **Single Source of Truth**
All repository types derive from database entities in `~/infrastructure/entities`. This prevents type drift and ensures consistency across the application.

```typescript
// ✅ CORRECT: Derive from database entity
export type CourseCreateData = Omit<DbCourseEntity, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

// ❌ FORBIDDEN: Manual type definitions
interface CourseCreateData {
  title: string;        // Could drift from DbCourseEntity
  description: string;  // Could become out of sync
}
```

### 2. **Dedicated Methods Over Generic Operations**
Each repository method handles ONE specific operation, replacing generic `update()` methods with explicit operations.

```typescript
// ✅ CORRECT: Explicit, dedicated methods
interface ICourseRepository {
  updateBasicInfo(id: string, input: CourseBasicInfoPartialUpdate, context: RepositoryContext): Promise<void>;
  updateVisibility(id: string, input: CourseVisibilityUpdate, context: RepositoryContext): Promise<void>;
  updateThumbnail(id: string, input: CourseThumbnailUpdate, context: RepositoryContext): Promise<void>;
}

// ❌ FORBIDDEN: Generic update method
interface ICourseRepository {
  update(id: string, data: unknown, context: RepositoryContext): Promise<void>;
}
```

### 3. **Repository as Single Validation Point**
All input validation happens at the repository boundary using Zod schemas, ensuring runtime safety and proper error handling.

### 4. **Type Safety at Compile-Time and Runtime**
TypeScript provides compile-time safety, while Zod schemas provide runtime validation with automatic type inference.

## Entity-Based Type System

### Type Derivation Patterns

Our type system uses TypeScript's utility types to create precise subsets of database entities:

```typescript
// Database entity (single source of truth)
export interface DbCourseEntity extends AuditableDocument, OwnedResourceEntity {
  title: string;
  description: string;
  slug: string;
  instructors: ObjectId[];
  chapters: DbChapter[];
  visibility: 'public' | 'unlisted' | 'private';
  courseOverview: DbCourseOverview;
  thumbnailUrl?: string;
  tags?: string[];
}

// Repository types (derived from entity)
export type CourseCreateData = Omit<DbCourseEntity, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type CourseBasicInfoUpdate = Pick<DbCourseEntity, 'title' | 'description' | 'slug'>;
export type CourseBasicInfoPartialUpdate = Partial<CourseBasicInfoUpdate>;
export type CourseVisibilityUpdate = Pick<DbCourseEntity, 'visibility'>;
export type CourseThumbnailUpdate = Pick<DbCourseEntity, 'thumbnailUrl'>;
```

### Entity Naming Convention

The project follows a consistent naming convention for database entities:

- **Database Entities**: Use `Db` prefix + `Entity` suffix (e.g., `DbCourseEntity`, `DbProductEntity`)
- **Nested Entity Types**: Use `Db` prefix (e.g., `DbChapter`, `DbCourseOverview`)
- **Domain Models**: No prefix (e.g., `Course`, `Chapter` - for API/service layer)

```typescript
// ✅ Database entity naming
export interface DbCourseEntity extends AuditableDocument {
  chapters: DbChapter[];        // Nested entity type
  courseOverview: DbCourseOverview; // Union type within entity
}

// ✅ Domain model naming (for services/API)
export interface Course {
  chapters: Chapter[];          // Domain model type
  courseOverview: CourseOverview; // Domain model type
}
```

### Benefits of Entity-Based Types

1. **🔒 Type Safety**: Impossible to use wrong field names or types
2. **🔄 Automatic Updates**: Entity changes automatically propagate to repository types
3. **📝 Self-Documenting**: Types clearly show what each operation affects
4. **🚫 Prevents Drift**: No manual type definitions that can become stale
5. **🏷️ Clear Naming**: `Db` prefix distinguishes database entities from domain models

## Validation Architecture

### Schema-Type Alignment

Every repository operation is protected by a Zod schema that exactly matches its TypeScript type using the `matches<T>()` utility:

```typescript
import { matches } from '~/lib/validation/zod-utils';

// Type definition
export type CourseBasicInfoPartialUpdate = Partial<Pick<DbCourseEntity, 'title' | 'description' | 'slug'>>;

// Aligned schema (Zod v4)
export const RepoCourseBasicInfoSchema = matches<CourseBasicInfoPartialUpdate>()(
  z.object({
    title: commonValidation.nonEmptyString.optional(),
    description: z.string().optional(),
    slug: commonValidation.slug.optional(),
  }).partial()
);

// Note: Zod v4 changes:
// - matches<T>() now uses 'any' for type parameters instead of ZodTypeDef
// - z.record() requires 2 arguments: z.record(keySchema, valueSchema)
// - Nested defaults must match parent defaults
```

### Runtime Validation Flow

```typescript
async updateBasicInfo(id: string, input: CourseBasicInfoPartialUpdate, context: RepositoryContext): Promise<void> {
  try {
    // ✅ Validation happens here in repository
    const validatedData = RepoCourseBasicInfoSchema.parse(input);
    
    // MongoDB operations with validated data
    const result = await this.collection.updateById(
      this.parseObjectId(id), 
      { $set: validatedData },
      { userContext: this.resolveUserContext(context) }
    );
    
    this.appContext.logger.info('Course basic info updated successfully', {
      courseId: id,
      fieldsUpdated: Object.keys(validatedData),
      operation: 'updateBasicInfo'
    });
  } catch (error) {
    this.appContext.logger.error('Course basic info update failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      courseId: id,
      operation: 'updateBasicInfo'
    });
    throw error;
  }
}
```

### ObjectId Conversion Patterns

```typescript
// Centralized ObjectId parsing with validation
private parseObjectId(id: string): ObjectId {
  if (!isValidObjectId(id)) {
    throw new Err.ValidationError(`Invalid ObjectId format: ${id}. Expected 24-character hex string.`, {
      objectId: id,
      expectedFormat: '24-character hex string'
    });
  }
  return new ObjectId(id);
}

// Zod utilities for automatic conversion (Zod v4)
import { zObjectId, zObjectIdArray } from '~/lib/validation/zod-utils';

const schema = z.object({
  instructors: zObjectIdArray,  // string[] → ObjectId[] automatically
  courseId: zObjectId,          // string → ObjectId automatically
});

// Zod v4 ObjectId transformers
export const zObjectId = z
  .string()
  .refine((val) => ObjectId.isValid(val), {
    message: 'Invalid ObjectId format. Expected 24-character hex string.'
  })
  .transform((val) => new ObjectId(val));

export const zObjectIdArray = z
  .array(z.string())
  .refine((arr) => arr.every(id => ObjectId.isValid(id)), {
    message: 'All items must be valid ObjectId format (24-character hex strings).'
  })
  .transform((arr) => arr.map(id => new ObjectId(id)));
```

## Implementation Patterns

### Repository Interface Structure

```typescript
export interface ICourseRepository {
  // =============================================================================
  // BASIC CRUD OPERATIONS
  // =============================================================================
  create(input: CourseCreateData, context: RepositoryContext): Promise<Course>;
  findById(id: string): Promise<Course | null>;
  delete(id: string, context: RepositoryContext): Promise<void>;

  // =============================================================================
  // DEDICATED UPDATE METHODS (No generic update!)
  // =============================================================================
  updateBasicInfo(id: string, input: CourseBasicInfoPartialUpdate, context: RepositoryContext): Promise<void>;
  updateVisibility(id: string, input: CourseVisibilityUpdate, context: RepositoryContext): Promise<void>;
  updateThumbnail(id: string, input: CourseThumbnailUpdate, context: RepositoryContext): Promise<void>;
  
  // =============================================================================
  // SPECIALIZED OPERATIONS
  // =============================================================================
  addChapter(courseId: string, input: ChapterCreateData, context: RepositoryContext): Promise<Chapter>;
  reorderChapters(input: ChapterReorderData, context: RepositoryContext): Promise<void>;
  
  // =============================================================================
  // QUERY OPERATIONS
  // =============================================================================
  findByCriteria(criteria: CourseCriteria): Promise<CourseListResult>;
  
  // =============================================================================
  // VALIDATION HELPERS
  // =============================================================================
  isSlugUnique(input: CourseSlugValidation): Promise<boolean>;
}
```

### Repository Implementation Structure

```typescript
export class MongoCourseRepository extends BaseMongoRepository<DbCourseEntity> implements ICourseRepository {
  constructor(private appContext: AppContext, db: Db) {
    super(db, 'courses', {
      monguardOptions: { enableAuditLogging: true }
    });
  }

  protected getLogger() {
    return this.appContext.logger;
  }

  // Centralized ObjectId parsing
  private parseObjectId(id: string): ObjectId { /* ... */ }

  // Domain conversion helpers
  private documentToCourse(doc: DbCourseEntity): Course { /* ... */ }
  private chapterToDbChapter(chapter: Chapter): DbChapter { /* ... */ }

  // Repository methods with validation
  async updateBasicInfo(id: string, input: CourseBasicInfoPartialUpdate, context: RepositoryContext): Promise<void> {
    const validatedData = RepoCourseBasicInfoSchema.parse(input);
    // MongoDB operations...
  }
}
```

### Naming Conventions

| Pattern | Example | Purpose |
|---------|---------|---------|
| `EntityCreateData` | `CourseCreateData` | Data required for entity creation |
| `EntityFieldUpdate` | `CourseVisibilityUpdate` | Update specific field(s) |
| `EntityFieldPartialUpdate` | `CourseBasicInfoPartialUpdate` | Optional field updates |
| `EntityOperationData` | `ChapterReorderData` | Complex operation data |
| `RepoEntityOperationSchema` | `RepoCourseBasicInfoSchema` | Validation schema |

## Service Integration

### Service Layer Database Independence ⭐

**CRITICAL ARCHITECTURAL PRINCIPLE**: The service layer is completely database-agnostic and NEVER contains MongoDB syntax or database-specific operations.

#### Service-Repository Separation

**Service Layer Responsibilities:**
- Business logic and permission checking
- Pass domain model types (strings) to repository methods
- Integration with other services (ResourceAccess, etc.)
- Error handling and user-facing responses
- **NEVER handle ObjectId conversions or database-specific types**

**Repository Layer Responsibilities:**
- Accept domain model types from service layer
- Convert strings to ObjectId internally using Zod schemas
- Input validation with type-safe schema conversion
- MongoDB operations and query construction
- All database schema mapping and transformations

### Service Layer Implementation - Database Independent ✅

```typescript
export class CourseService implements ICourseService {
  constructor(
    private appContext: AppContext,
    private courseRepository: ICourseRepository,
    private resourceAccessService: IResourceAccessService
  ) {}

  async updateChapter(courseId: string, chapterId: string, chapterData: UpdateChapterRequest, user: AuthorizedUser): Promise<void> {
    // 1. Permission checking (service responsibility)
    if (!hasPermission(user, PERMISSIONS.COURSES_UPDATE_OWN) && !hasPermission(user, PERMISSIONS.COURSES_UPDATE_ANY)) {
      throw new Err.ForbiddenError('You do not have permission to modify courses');
    }

    this.appContext.logger.info('Updating chapter', {
      courseId,
      chapterId,
      userId: user.id,
      operation: 'updateChapter',
      service: 'CourseService'
    });

    // 2. Business logic validation (service responsibility)
    const existingCourse = await this.courseRepository.findById(courseId);
    if (!existingCourse) {
      throw new Err.NotFoundError('Course not found');
    }

    // 3. Pass domain types (strings) to repository - NO ObjectId conversion ✅
    // Handle title updates
    if (chapterData.title !== undefined) {
      await this.courseRepository.updateChapterBasicInfo(courseId, chapterId, {
        title: chapterData.title
      }, { operatedBy: user.id });
    }
    
    // Handle itemIds updates - pass strings directly ✅
    if (chapterData.itemIds !== undefined) {
      await this.courseRepository.updateChapterItems(courseId, chapterId, {
        itemIds: chapterData.itemIds  // Strings - repository handles ObjectId conversion
      }, { operatedBy: user.id });
    }

    this.appContext.logger.info('Chapter updated successfully', {
      courseId,
      chapterId,
      operation: 'updateChapter'
    });
  }

  async createCourse(data: CreateCourseRequest, userId: string): Promise<Course> {
    this.appContext.logger.info('Creating course', {
      userId,
      title: data.title,
      operation: 'createCourse',
      service: 'CourseService'
    });

    // Service builds nested domain objects (NO MongoDB syntax) ✅
    const courseData: CreateCourseWithOwnerRequest = {
      ownerId: userId,           // String - repository converts to ObjectId
      title: data.title,
      description: data.description,
      slug: data.slug,
      instructors: data.instructors || [],  // String[] - repository converts to ObjectId[]
      chapters: (data.chapters || []).map(chapter => ({
        title: chapter.title,
        itemIds: chapter.itemIds || [],     // String[] - repository converts to ObjectId[]
        order: chapter.order || 0,
      })),
      visibility: data.visibility || 'private',
      courseOverview: data.courseOverview || { type: 'empty' },
      thumbnailUrl: data.thumbnailUrl,
      tags: data.tags,
    };

    // Pass domain object to repository - repository handles all ObjectId conversion ✅
    const course = await this.courseRepository.create(courseData, { operatedBy: userId });
    
    this.appContext.logger.info('Course created successfully', {
      courseId: course.id,
      userId,
      operation: 'createCourse'
    });

    return course;
  }
}
```

### DTO to Domain Type Conversion - Database Independent ✅

```typescript
// Service receives DTOs from API/UI layer
interface UpdateChapterRequest {
  title?: string;
  itemIds?: string[];  // String IDs from API
}

// ✅ NEW: Service passes domain types (strings) directly - NO ObjectId conversion
if (chapterData.title !== undefined) {
  // Pass domain type directly to repository
  await this.courseRepository.updateChapterBasicInfo(courseId, chapterId, {
    title: chapterData.title  // String - repository handles validation
  }, context);
}

if (chapterData.itemIds !== undefined) {
  // Pass string array directly - repository converts to ObjectId[]
  await this.courseRepository.updateChapterItems(courseId, chapterId, {
    itemIds: chapterData.itemIds  // String[] - repository schema converts to ObjectId[]
  }, context);
}
```

### Repository Interface - Accepts Domain Types ✅

```typescript
// ✅ NEW: Repository interfaces accept domain model types (strings)
interface ICourseRepository {
  // Accept domain types from service layer
  create(input: CreateCourseWithOwnerRequest, context: RepositoryContext): Promise<Course>;
  updateChapterItems(courseId: string, chapterId: string, input: { itemIds: string[] }, context: RepositoryContext): Promise<void>;
  updateCourseOverview(id: string, input: { courseOverview: CourseOverview }, context: RepositoryContext): Promise<void>;
  addChapter(courseId: string, input: ChapterInput, context: RepositoryContext): Promise<Chapter>;
}

// ✅ Repository implementation handles string → ObjectId conversion via schemas
export class MongoCourseRepository implements ICourseRepository {
  async create(input: CreateCourseWithOwnerRequest, context: RepositoryContext): Promise<Course> {
    // Schema automatically converts strings to ObjectIds
    const validatedData = RepoCourseCreateSchema.parse(input);
    // validatedData now has ObjectIds for database operations
    
    const doc = {
      ...validatedData,
      // Monguard automatically handles createdAt and updatedAt timestamps
    } as Omit<DbCourseEntity, '_id' | 'createdAt' | 'updatedAt'>;

    const result = await this.collection.insertOne(doc, {
      userContext: this.resolveUserContext(context)
    });

    return this.documentToCourse({ ...doc, _id: result.insertedId });
  }

  async updateChapterItems(courseId: string, chapterId: string, input: { itemIds: string[] }, context: RepositoryContext): Promise<void> {
    // Schema converts string[] to ObjectId[]
    const data = RepoChapterItemsSchema.parse(input);
    // data.itemIds is now ObjectId[] for MongoDB operations
    
    await this.collection.updateOne(
      { _id: this.parseObjectId(courseId), 'chapters.id': this.parseObjectId(chapterId) },
      { $set: { 'chapters.$.itemIds': data.itemIds } },
      { userContext: this.resolveUserContext(context) }
    );
  }
}
```

### Schema Conversion Architecture ✅

```typescript
// Service-level domain types (strings)
interface CreateCourseWithOwnerRequest {
  ownerId: string;          // Domain type
  instructors: string[];    // Domain type
  chapters?: ChapterInput[]; // Domain type
}

interface ChapterInput {
  title: string;
  itemIds?: string[];       // Domain type
  order?: number;
}

// Internal repository schema type (ObjectIds for database)
type RepoCourseCreateData = {
  ownerId: ObjectId;        // Database type
  instructors: ObjectId[];  // Database type
  chapters?: {
    title: string;
    itemIds?: ObjectId[];   // Database type
    order?: number;
  }[];
};

// Schema performs automatic conversion
export const RepoCourseCreateSchema = matches<RepoCourseCreateData>()(
  z.object({
    ownerId: zObjectId,              // string → ObjectId
    instructors: zObjectIdArray,     // string[] → ObjectId[]
    chapters: z.array(z.object({
      title: commonValidation.nonEmptyString,
      itemIds: zObjectIdArray.optional(), // string[] → ObjectId[]
      order: z.number().int().min(0).optional(),
    })).optional(),
    // ... other fields
  })
);
```

## Migration Guide

### Service Layer Database Independence Migration ⭐

This section documents the critical architectural migration to achieve complete service layer database independence.

#### Before: Service Layer with MongoDB Dependencies ❌

```typescript
// ❌ OLD: Service layer importing and using MongoDB ObjectId
import { ObjectId } from 'mongodb';

export class CourseService {
  async createCourse(data: CreateCourseRequest, userId: string): Promise<Course> {
    // ❌ Service layer handling ObjectId conversion
    const courseData = {
      ownerId: new ObjectId(userId),     // MongoDB dependency in service!
      instructors: data.instructors.map(id => new ObjectId(id)), // MongoDB syntax!
      chapters: (data.chapters || []).map(chapter => ({
        title: chapter.title,
        itemIds: chapter.itemIds?.map(id => new ObjectId(id)) || [], // ObjectId conversion!
        order: chapter.order || 0,
      })),
    };

    return await this.courseRepository.create(courseData, { operatedBy: userId });
  }

  async updateCourseOverview(courseId: string, assetId: string, userId: string): Promise<void> {
    // ❌ Service layer creating ObjectId
    await this.courseRepository.updateCourseOverview(courseId, {
      courseOverview: { type: 'asset', assetId: new ObjectId(assetId) } // MongoDB ObjectId!
    }, { operatedBy: userId });
  }
}

// ❌ Repository interface expecting ObjectId types
interface ICourseRepository {
  create(input: CourseCreateData, context: RepositoryContext): Promise<Course>; // CourseCreateData has ObjectId fields
  updateCourseOverview(id: string, input: CourseOverviewUpdate, context: RepositoryContext): Promise<void>; // Expects ObjectId
}
```

#### After: Service Layer Database Independence ✅

```typescript
// ✅ NEW: No MongoDB imports in service layer
export class CourseService {
  async createCourse(data: CreateCourseRequest, userId: string): Promise<Course> {
    // ✅ Service layer works with domain types (strings only)
    const courseData: CreateCourseWithOwnerRequest = {
      ownerId: userId,                    // String - database agnostic
      instructors: data.instructors || [], // String[] - database agnostic
      chapters: (data.chapters || []).map(chapter => ({
        title: chapter.title,
        itemIds: chapter.itemIds || [],   // String[] - database agnostic
        order: chapter.order || 0,
      })),
    };

    // ✅ Repository handles all ObjectId conversion internally
    return await this.courseRepository.create(courseData, { operatedBy: userId });
  }

  async updateCourseOverview(courseId: string, assetId: string, userId: string): Promise<void> {
    // ✅ Service passes domain types (strings)
    await this.courseRepository.updateCourseOverview(courseId, {
      courseOverview: { type: 'asset', assetId: assetId } // String - repository converts to ObjectId
    }, { operatedBy: userId });
  }
}

// ✅ Repository interface accepts domain types (strings)
interface ICourseRepository {
  create(input: CreateCourseWithOwnerRequest, context: RepositoryContext): Promise<Course>; // Domain types (strings)
  updateCourseOverview(id: string, input: { courseOverview: CourseOverview }, context: RepositoryContext): Promise<void>; // Domain types
}

// ✅ Repository implementation handles conversion via schemas
export class MongoCourseRepository implements ICourseRepository {
  async create(input: CreateCourseWithOwnerRequest, context: RepositoryContext): Promise<Course> {
    // Schema converts strings to ObjectIds automatically
    const validatedData = RepoCourseCreateSchema.parse(input);
    // Now validatedData has ObjectIds for database operations
    
    const result = await this.collection.insertOne(validatedData, {
      userContext: this.resolveUserContext(context)
    });
    
    return this.documentToCourse({ ...validatedData, _id: result.insertedId });
  }
}
```

#### Migration Benefits Achieved

1. **🔒 Database Independence**: Service layer works with any database - not tied to MongoDB
2. **🧪 Testability**: Services can be tested without database-specific mocks
3. **🔄 Maintainability**: Business logic separated from database implementation details  
4. **🛡️ Type Safety**: Schema validation ensures correct ObjectId conversion
5. **🎯 Single Responsibility**: Services focus on business logic, repositories handle data access

#### Key Migration Rules

**✅ Do:**
- Service layer works with domain model types (strings)
- Repository interfaces accept domain types 
- Repository schemas handle string → ObjectId conversion
- Use `matches<InternalRepoType>()` for schema validation with ObjectId types

**❌ Never:**
- Import `ObjectId` from `'mongodb'` in service layer
- Perform ObjectId conversion in service layer
- Mix database-specific types with business logic
- Use repository entity types (ObjectId) in service method signatures

### Converting from Generic Update Methods

#### Before: Generic Update Pattern ❌

```typescript
// Old generic approach
interface ICourseRepository {
  update(id: string, data: unknown, context: RepositoryContext): Promise<void>;
}

// Service layer - unclear what's being updated
await this.courseRepository.update(courseId, {
  title: 'New Title',
  visibility: 'private',
  'chapters.$.title': 'New Chapter Title'  // MongoDB dot notation mixed in
}, { operatedBy: user.id });
```

#### After: Dedicated Methods Pattern ✅

```typescript
// New dedicated approach
interface ICourseRepository {
  updateBasicInfo(id: string, input: CourseBasicInfoPartialUpdate, context: RepositoryContext): Promise<void>;
  updateVisibility(id: string, input: CourseVisibilityUpdate, context: RepositoryContext): Promise<void>;
  updateChapterBasicInfo(courseId: string, chapterId: string, input: ChapterBasicInfoPartialUpdate, context: RepositoryContext): Promise<void>;
}

// Service layer - clear, explicit operations
await this.courseRepository.updateBasicInfo(courseId, { title: 'New Title' }, { operatedBy: user.id });
await this.courseRepository.updateVisibility(courseId, { visibility: 'private' }, { operatedBy: user.id });
await this.courseRepository.updateChapterBasicInfo(courseId, chapterId, { title: 'New Chapter Title' }, { operatedBy: user.id });
```

### Common Type Error Resolution

#### Error: "Expected 2 arguments, but got 3"

**Problem**: Old repository method signature doesn't match new interface

```typescript
// ❌ Old signature
await courseRepository.reorderChapters(courseId, chapterIds, context);

// ✅ New signature  
await courseRepository.reorderChapters({ courseId, chapterOrderMap }, context);
```

#### Error: "Type 'unknown' is not assignable to parameter"

**Problem**: Generic input type needs entity-specific type

```typescript
// ❌ Generic input
async update(id: string, data: unknown, context: RepositoryContext): Promise<void>

// ✅ Entity-specific input
async updateBasicInfo(id: string, input: CourseBasicInfoPartialUpdate, context: RepositoryContext): Promise<void>
```

### Testing Migration

```typescript
// Update test methods to match new interface
describe('CourseRepository', () => {
  it('should update course basic info', async () => {
    // ❌ Old test
    await courseRepository.update(courseId, { title: 'New Title' }, mockContext);

    // ✅ New test
    await courseRepository.updateBasicInfo(courseId, { title: 'New Title' }, mockContext);
  });
  
  it('should reorder chapters', async () => {
    // ❌ Old test
    await courseRepository.reorderChapters(courseId, [chapter1Id, chapter2Id], mockContext);

    // ✅ New test
    const chapterOrderMap = { [chapter1Id]: 0, [chapter2Id]: 1 };
    await courseRepository.reorderChapters({ courseId, chapterOrderMap }, mockContext);
  });
});
```

## Best Practices

### ✅ Do's

1. **Always derive types from database entities**
   ```typescript
   export type CourseCreateData = Omit<DbCourseEntity, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
   ```

2. **Use dedicated methods for each operation**
   ```typescript
   updateBasicInfo(id: string, input: CourseBasicInfoPartialUpdate, context: RepositoryContext): Promise<void>;
   updateVisibility(id: string, input: CourseVisibilityUpdate, context: RepositoryContext): Promise<void>;
   ```

3. **Validate at repository boundary**
   ```typescript
   const validatedData = RepoCourseBasicInfoSchema.parse(input);
   ```

4. **Keep service layer database-agnostic** ⭐
   ```typescript
   // ✅ Service builds nested domain objects (strings only)
   const domainUpdate = { courseOverview: { type: 'asset', assetId: assetId } }; // String - no ObjectId!
   await this.courseRepository.updateCourseOverview(courseId, domainUpdate, context);
   ```

5. **Use AppContext for dependency injection**
   ```typescript
   constructor(private appContext: AppContext, db: Db) {
     super(db, 'courses');
   }
   ```

### ❌ Don'ts

1. **Never use generic update methods**
   ```typescript
   // ❌ FORBIDDEN
   update(id: string, data: unknown): Promise<void>;
   ```

2. **Never put MongoDB syntax in service layer** ⭐
   ```typescript
   // ❌ FORBIDDEN in service
   const update = { $set: { 'chapters.$.title': title } };
   ```

3. **Never import or use ObjectId in service layer** ⭐
   ```typescript
   // ❌ FORBIDDEN in service
   import { ObjectId } from 'mongodb';
   const courseData = { ownerId: new ObjectId(userId) };
   ```

4. **Never pass ObjectId types to repository interfaces** ⭐
   ```typescript
   // ❌ FORBIDDEN
   interface ICourseRepository {
     create(input: CourseCreateData, context: RepositoryContext): Promise<Course>; // If CourseCreateData has ObjectId fields
   }
   ```

5. **Never create manual type definitions**
   ```typescript
   // ❌ FORBIDDEN
   interface CourseUpdate {
     title?: string;  // Could drift from DbCourse
   }
   ```

6. **Never skip validation**
   ```typescript
   // ❌ FORBIDDEN
   async updateBasicInfo(input: any) {
     await this.collection.updateById(id, input);  // No validation!
   }
   ```

7. **Never mix business logic in repository**
   ```typescript
   // ❌ FORBIDDEN in repository
   if (user.role === 'admin') {  // Business logic belongs in service
     // ...
   }
   ```

### Performance Considerations

1. **Validation Overhead**: Zod validation adds minimal overhead but prevents runtime errors
2. **Type Compilation**: Entity-based types have no runtime cost
3. **Method Granularity**: Dedicated methods prevent unnecessary field updates
4. **MongoDB Operations**: Direct MongoDB operations without abstraction layers

### Error Handling Standards

```typescript
try {
  const validatedData = schema.parse(input);
  const result = await this.collection.updateById(id, { $set: validatedData });

  this.appContext.logger.info('Operation completed successfully', {
    operation: 'updateBasicInfo',
    entityId: id,
    fieldsUpdated: Object.keys(validatedData)
  });
} catch (error) {
  this.appContext.logger.error('Operation failed', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    operation: 'updateBasicInfo',
    entityId: id
  });
  throw error;
}
```

### Zod v4 Migration Guide

This project uses Zod v4, which includes several breaking changes from v3. Here's what you need to know:

#### Key Breaking Changes

**1. `z.record()` now requires 2 arguments**

```typescript
// ❌ Zod v3 - Single argument
const schema = z.object({
  metadata: z.record(z.string()).optional(),
  sort: z.record(z.union([z.literal(1), z.literal(-1)])).optional(),
});

// ✅ Zod v4 - Two arguments (key schema, value schema)
const schema = z.object({
  metadata: z.record(z.string(), z.string()).optional(),
  sort: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
});
```

**2. Type parameter changes in `matches<T>()` utility**

```typescript
// ❌ Zod v3 - Used ZodTypeDef
export const matches = <T>() => <S extends z.ZodType<T, z.ZodTypeDef, unknown>>(
  schema: AssertEqual<S['_output'], T> extends true ? S : never
): S => schema;

// ✅ Zod v4 - Use 'any' for type parameters
export const matches = <T>() => <S extends z.ZodType<T, any, any>>(
  schema: AssertEqual<S['_output'], T> extends true ? S : never
): S => schema;
```

**3. Error property renamed: `errors` → `issues`**

```typescript
// ❌ Zod v3 - Used error.errors
export function formatZodError(error: z.ZodError): string {
  const messages = error.errors.map(err => {
    const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
    return `${path}${err.message}`;
  });
  return messages.join('; ');
}

// ✅ Zod v4 - Use error.issues
export function formatZodError(error: z.ZodError): string {
  const messages = error.issues.map(err => {
    const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
    return `${path}${err.message}`;
  });
  return messages.join('; ');
}
```

**4. Nested defaults require matching parent defaults**

```typescript
// ❌ Zod v3 - Empty object default worked
z.object({
  includeCompleted: z.boolean().optional().default(true),
  limit: z.number().optional(),
}).optional().default({})

// ✅ Zod v4 - Parent default must include child defaults
z.object({
  includeCompleted: z.boolean().optional().default(true),
  limit: z.number().optional(),
}).optional().default({ includeCompleted: true })
```

#### Updated Validation Utilities

```typescript
// ~/server/lib/validation/zod-utils.ts (Zod v4 compatible)
import { z } from 'zod';
import { ObjectId } from 'mongodb';

// ObjectId transformer (v4 compatible)
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

// ObjectId array transformer
export const zObjectIdArray = z
  .array(z.string())
  .refine((arr) => arr.every(id => ObjectId.isValid(id)), {
    message: 'All items must be valid ObjectId format (24-character hex strings).'
  })
  .transform((arr) => arr.map(id => new ObjectId(id)));

// Type-safe matches utility (v4 compatible)
export const matches = <T>() => <S extends z.ZodType<T, any, any>>(
  schema: AssertEqual<S['_output'], T> extends true
    ? S
    : S & {
        'types do not match': {
          expected: T;
          received: S['_output'];
        };
      }
): S => schema;

// Error formatting (v4 compatible)
export function formatZodError(error: z.ZodError): string {
  const messages = error.issues.map(err => {
    const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
    return `${path}${err.message}`;
  });
  return messages.join('; ');
}
```

#### Migration Checklist

When working with Zod schemas in this project:

- ✅ Always use `z.record(z.string(), valueSchema)` with 2 arguments
- ✅ Use `error.issues` instead of `error.errors` when handling validation errors
- ✅ Ensure nested defaults match parent object defaults
- ✅ Use `any` type parameters in generic Zod utilities
- ✅ Import validation utilities from `~/server/lib/validation/zod-utils`

## Conclusion

This Entity-Based Repository Architecture with Service Layer Database Independence provides:

- **🔒 Type Safety**: Compile-time and runtime type checking
- **📋 Clear Interfaces**: Explicit methods for each operation  
- **🔄 Maintainability**: Types automatically update with schema changes
- **🚫 Error Prevention**: Validation catches issues before database operations
- **📖 Self-Documentation**: Code clearly expresses intent and capabilities
- **🏗️ Scalability**: Pattern scales to complex domains without breaking
- **⭐ Database Independence**: Service layer works with any database technology
- **🧪 Enhanced Testability**: Services can be tested without database-specific dependencies
- **🎯 Separation of Concerns**: Clear boundaries between business logic and data access

### Key Architectural Achievements

1. **Service Layer Database Independence**: Services work with domain types (strings), never database-specific types
2. **Automatic Type Conversion**: Repository schemas handle string → ObjectId conversion transparently  
3. **Repository Interface Evolution**: Interfaces accept domain types while implementations handle database specifics
4. **Schema-Driven Validation**: Type-safe conversion with runtime validation using `matches<T>()`

The architecture eliminates common repository anti-patterns while providing the foundation for robust, maintainable, and database-agnostic data access layers.