/**
 * Todo Repository Zod Schemas
 * 
 * This file defines Zod validation schemas for Todo repository operations.
 * All schemas use matches<T>() utility to ensure runtime validation aligns with TypeScript types.
 * 
 * Key features:
 * 1. Type-safe validation with matches<T>() alignment
 * 2. Runtime safety for all repository operations
 * 3. Auto-conversion: string -> ObjectId for userId fields
 */

import { z } from 'zod';
import { type ObjectId } from 'mongodb';
import { matches, commonValidation, zObjectId } from '~/server/lib/validation/zod-utils';
import type { DbTodoEntity } from '~/server/infrastructure/entities';

// =============================================================================
// INTERNAL REPOSITORY SCHEMA TYPES (for database operations)
// =============================================================================

/**
 * Internal repository create data type (for database operations)
 * Converts string userId to ObjectId for MongoDB storage
 */
type RepoTodoCreateData = {
  title: string;
  description?: string;
  userId: ObjectId;
  completed: boolean;
};

/**
 * Internal content update data type
 */
type RepoTodoContentUpdateData = Partial<Pick<DbTodoEntity, 'title' | 'description'>>;

/**
 * Internal status update data type
 */
type RepoTodoStatusUpdateData = Pick<DbTodoEntity, 'completed'>;

/**
 * Internal title update data type
 */
type RepoTodoTitleUpdateData = Pick<DbTodoEntity, 'title'>;

/**
 * Internal description update data type
 */
type RepoTodoDescriptionUpdateData = Pick<DbTodoEntity, 'description'>;

// =============================================================================
// TODO CREATE SCHEMAS
// =============================================================================

/**
 * Schema for creating todos
 * Converts string userId to ObjectId
 */
export const RepoTodoCreateSchema = matches<RepoTodoCreateData>()(
  z.object({
    title: commonValidation.nonEmptyString.max(200, 'Title too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    userId: zObjectId,
    completed: z.boolean().default(false),
  })
);

// =============================================================================
// TODO UPDATE SCHEMAS
// =============================================================================

/**
 * Schema for updating todo content (title and description)
 */
export const RepoTodoContentUpdateSchema = matches<RepoTodoContentUpdateData>()(
  z.object({
    title: commonValidation.nonEmptyString.max(200, 'Title too long').optional(),
    description: z.string().max(1000, 'Description too long').optional(),
  }).partial()
);

/**
 * Schema for updating todo completion status
 */
export const RepoTodoStatusUpdateSchema = matches<RepoTodoStatusUpdateData>()(
  z.object({
    completed: z.boolean(),
  })
);

/**
 * Schema for updating todo title only
 */
export const RepoTodoTitleUpdateSchema = matches<RepoTodoTitleUpdateData>()(
  z.object({
    title: commonValidation.nonEmptyString.max(200, 'Title too long'),
  })
);

/**
 * Schema for updating todo description only
 */
export const RepoTodoDescriptionUpdateSchema = matches<RepoTodoDescriptionUpdateData>()(
  z.object({
    description: z.string().max(1000, 'Description too long').optional(),
  })
);

// =============================================================================
// QUERY VALIDATION SCHEMAS
// =============================================================================

/**
 * Schema for validating ObjectId parameters
 */
export const RepoObjectIdSchema = z.string().min(24).max(24).regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

/**
 * Schema for validating user queries with pagination
 */
export const RepoTodoUserQuerySchema = z.object({
  userId: RepoObjectIdSchema,
  includeCompleted: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional(),
  skip: z.number().min(0).optional(),
  sort: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
});

/**
 * Schema for validating todo status queries
 */
export const RepoTodoStatusQuerySchema = z.object({
  userId: RepoObjectIdSchema,
  completed: z.boolean(),
});