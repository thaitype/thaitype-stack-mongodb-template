import { z } from 'zod';
import { ObjectId } from 'mongodb';

/**
 * Zod schema for MongoDB ObjectId validation and transformation
 * Accepts string input, validates ObjectId format, and transforms to ObjectId instance
 */
export const zObjectId = z
  .string()
  .refine((val) => ObjectId.isValid(val), { 
    message: 'Invalid ObjectId format. Expected 24-character hex string.' 
  })
  .transform((val) => new ObjectId(val));

/**
 * Optional ObjectId schema - accepts string or undefined, transforms valid strings to ObjectId
 */
export const zObjectIdOptional = z
  .string()
  .optional()
  .refine((val) => val === undefined || ObjectId.isValid(val), {
    message: 'Invalid ObjectId format. Expected 24-character hex string or undefined.'
  })
  .transform((val) => val ? new ObjectId(val) : undefined);

/**
 * Array of ObjectIds schema - accepts string[], validates each, transforms to ObjectId[]
 */
export const zObjectIdArray = z
  .array(z.string())
  .refine((arr) => arr.every(id => ObjectId.isValid(id)), {
    message: 'All items must be valid ObjectId format (24-character hex strings).'
  })
  .transform((arr) => arr.map(id => new ObjectId(id)));

/**
 * Type assertion helper to ensure schema output exactly matches expected type
 * Provides compile-time safety between Zod schemas and entity types
 */
export type AssertEqual<T, U> = (<V>() => V extends T ? 1 : 2) extends <V>() => V extends U ? 1 : 2 
  ? true 
  : false;

/**
 * Schema type matcher function that ensures Zod schema output exactly matches target type T
 * Usage: matches<EntityType>()(zodSchema) 
 * 
 * Benefits:
 * - Compile-time type safety between schemas and entity types
 * - Prevents type drift between validation schemas and database entities
 * - Forces schema updates when entity types change
 * 
 * @example
 * ```typescript
 * type UserUpdate = Pick<DbUser, 'name' | 'email'>;
 * 
 * const UserUpdateSchema = matches<UserUpdate>()(
 *   z.object({
 *     name: z.string().optional(),
 *     email: z.string().email().optional(),
 *   }).partial()
 * );
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/**
 * Utility type for extracting the output type from a Zod schema
 * Useful for type annotations and ensuring consistency
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InferSchemaOutput<T extends z.ZodType<any, any, any>> = T['_output'];

/**
 * Common validation patterns for reuse across schemas
 */
export const commonValidation = {
  /**
   * Slug validation - lowercase letters, numbers, and hyphens only
   */
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  
  /**
   * Non-empty string validation
   */
  nonEmptyString: z.string().min(1, 'String cannot be empty'),
  
  /**
   * URL validation
   */
  url: z.string().url('Must be a valid URL'),
  
  /**
   * Course/Product visibility enum
   */
  visibility: z.enum(['public', 'private', 'unlisted']),
  
  /**
   * Course/Product status enum
   */
  status: z.enum(['draft', 'active', 'archived']),
  
  /**
   * Email validation
   */
  email: z.string().email('Must be a valid email address'),
} as const;

/**
 * Error handling utility for Zod validation failures
 * Converts Zod errors to user-friendly validation error messages
 */
export function formatZodError(error: z.ZodError): string {
  const messages = error.issues.map(err => {
    const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
    return `${path}${err.message}`;
  });

  return messages.join('; ');
}

/**
 * Safe parsing utility that throws ValidationError on failure
 * Integrates with existing error handling patterns
 */
export function safeParse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  
  if (!result.success) {
    const message = formatZodError(result.error);
    throw new Error(`Validation failed: ${message}`);
  }
  
  return result.data;
}