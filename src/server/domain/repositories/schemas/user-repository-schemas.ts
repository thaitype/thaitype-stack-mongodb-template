/**
 * User Repository Schemas
 * 
 * This file defines Zod validation schemas for User repository operations.
 * All schemas use matches<T>() utility to ensure runtime validation aligns with TypeScript types.
 * 
 * Key features:
 * 1. Type-safe validation with matches<T>() alignment
 * 2. Runtime safety for all repository operations
 * 3. Proper validation for Better Auth integration
 */

import { z } from 'zod';
import { matches, commonValidation } from '~/server/lib/validation/zod-utils';
import type { 
  DbUserEntity
} from '~/server/infrastructure/entities';

// =============================================================================
// INTERNAL REPOSITORY SCHEMA TYPES (for database operations)
// =============================================================================

/**
 * Internal repository create data type (for database operations)
 */
type RepoUserCreateData = {
  email: string;
  name: string;
  roles: ('admin')[]; // Not optional because schema has default
  bio?: string;
  avatar?: string;
  website?: string;
  isActive?: boolean;
};

/**
 * Internal basic info update data type
 */
type RepoUserBasicInfoUpdateData = Partial<Pick<DbUserEntity, 'name' | 'bio' | 'avatar' | 'website'>>;

/**
 * Internal roles update data type
 */
type RepoUserRolesUpdateData = Pick<DbUserEntity, 'roles'>;

/**
 * Internal email update data type
 */
type RepoUserEmailUpdateData = Pick<DbUserEntity, 'email'>;

/**
 * Internal status update data type
 */
type RepoUserStatusUpdateData = { isActive: boolean };

/**
 * Internal profile update data type
 */
type RepoUserProfileUpdateData = Partial<Pick<DbUserEntity, 'name' | 'bio' | 'avatar' | 'website'>>;

// =============================================================================
// ZOD VALIDATION SCHEMAS
// =============================================================================

/**
 * Schema for creating user records
 * Validates all required fields for user creation
 */
export const RepoUserCreateSchema = matches<RepoUserCreateData>()(
  z.object({
    email: commonValidation.email,
    name: commonValidation.nonEmptyString,
    roles: z.array(z.enum(['admin'])).default(['admin']),
    bio: z.string().optional(),
    avatar: z.string().url().optional(),
    website: z.string().url().optional(),
    isActive: z.boolean().default(true).optional(),
  })
);

/**
 * Schema for updating user basic information
 * Used for name, bio, avatar, website updates
 */
export const RepoUserBasicInfoUpdateSchema = matches<RepoUserBasicInfoUpdateData>()(
  z.object({
    name: commonValidation.nonEmptyString.optional(),
    bio: z.string().optional(),
    avatar: z.string().url().optional(),
    website: z.string().url().optional(),
  }).partial()
);

/**
 * Schema for updating user roles
 * Validates role enum values
 */
export const RepoUserRolesUpdateSchema = matches<RepoUserRolesUpdateData>()(
  z.object({
    roles: z.array(z.enum(['admin'])).min(1, 'User must have at least one role'),
  })
);

/**
 * Schema for updating user email
 * Validates email format
 */
export const RepoUserEmailUpdateSchema = matches<RepoUserEmailUpdateData>()(
  z.object({
    email: commonValidation.email,
  })
);

/**
 * Schema for updating user status
 * Validates boolean isActive field
 */
export const RepoUserStatusUpdateSchema = matches<RepoUserStatusUpdateData>()(
  z.object({
    isActive: z.boolean(),
  })
);

/**
 * Schema for updating user profile
 * Profile-specific fields only (excludes sensitive fields)
 */
export const RepoUserProfileUpdateSchema = matches<RepoUserProfileUpdateData>()(
  z.object({
    name: commonValidation.nonEmptyString.optional(),
    bio: z.string().optional(),
    avatar: z.string().url().optional(),
    website: z.string().url().optional(),
  }).partial()
);

/**
 * Schema for updating user name only
 */
export const RepoUserNameUpdateSchema = matches<Pick<DbUserEntity, 'name'>>()(
  z.object({
    name: commonValidation.nonEmptyString,
  })
);

/**
 * Schema for updating user bio only
 */
export const RepoUserBioUpdateSchema = matches<Pick<DbUserEntity, 'bio'>>()(
  z.object({
    bio: z.string().optional(),
  })
);

/**
 * Schema for updating user avatar only
 */
export const RepoUserAvatarUpdateSchema = matches<Pick<DbUserEntity, 'avatar'>>()(
  z.object({
    avatar: z.string().url().optional(),
  })
);

/**
 * Schema for updating user website only
 */
export const RepoUserWebsiteUpdateSchema = matches<Pick<DbUserEntity, 'website'>>()(
  z.object({
    website: z.string().url().optional(),
  })
);

// =============================================================================
// QUERY VALIDATION SCHEMAS
// =============================================================================

/**
 * Schema for role query validation
 */
export const UserRoleQuerySchema = z.object({
  role: z.enum(['admin']),
  includeInactive: z.boolean().default(false).optional(),
});

/**
 * Schema for email query validation
 */
export const UserEmailQuerySchema = z.object({
  email: commonValidation.email,
  includeInactive: z.boolean().default(false).optional(),
});

/**
 * Schema for user filter query validation
 */
export const UserFilterQuerySchema = z.object({
  email: commonValidation.email.optional(),
  roles: z.array(z.enum(['admin'])).optional(),
  isActive: z.boolean().optional(),
  limit: z.number().int().min(1).max(1000).default(100).optional(),
  skip: z.number().int().min(0).default(0).optional(),
  sort: z.record(z.string(), z.enum(['1', '-1']).transform(val => val === '1' ? 1 : -1)).optional(),
});

// =============================================================================
// SERVICE LAYER REQUEST SCHEMAS
// =============================================================================

/**
 * Schema for service layer user creation requests
 * Validates incoming service requests before repository operations
 */
export const UserCreateRequestSchema = z.object({
  email: commonValidation.email,
  name: commonValidation.nonEmptyString,
  roles: z.array(z.enum(['admin'])).default(['admin']).optional(),
  bio: z.string().optional(),
  avatar: z.string().url().optional(),
  website: z.string().url().optional(),
  isActive: z.boolean().default(true).optional(),
});

/**
 * Schema for service layer user update requests
 * Validates incoming service requests for user updates
 */
export const UserUpdateRequestSchema = z.object({
  name: commonValidation.nonEmptyString.optional(),
  roles: z.array(z.enum(['admin'])).min(1).optional(),
  bio: z.string().optional(),
  avatar: z.string().url().optional(),
  website: z.string().url().optional(),
  isActive: z.boolean().optional(),
}).partial();

/**
 * Schema for service layer profile update requests
 * Validates incoming service requests for profile updates
 */
export const UserProfileUpdateRequestSchema = z.object({
  name: commonValidation.nonEmptyString.optional(),
  bio: z.string().optional(),
  avatar: z.string().url().optional(),
  website: z.string().url().optional(),
}).partial();

// =============================================================================
// HELPER SCHEMAS
// =============================================================================

/**
 * Schema for user ID validation
 * Ensures valid user ID format
 */
export const UserIdValidationSchema = z.string().min(1, 'User ID is required');

/**
 * Schema for role validation
 * Ensures valid role enum values
 */
export const RoleValidationSchema = z.enum(['admin']);

/**
 * Schema for email validation with domain restrictions (if needed)
 * Comprehensive email validation
 */
export const EmailValidationSchema = z.string()
  .email('Invalid email format')
  .min(5, 'Email must be at least 5 characters')
  .max(254, 'Email must not exceed 254 characters')
  .toLowerCase()
  .transform(email => email.trim());

/**
 * Schema for name validation
 * Ensures proper name format and length
 */
export const NameValidationSchema = z.string()
  .min(1, 'Name is required')
  .max(100, 'Name must not exceed 100 characters')
  .transform(name => name.trim());

/**
 * Schema for bio validation
 * Optional bio with length limits
 */
export const BioValidationSchema = z.string()
  .max(500, 'Bio must not exceed 500 characters')
  .optional();

/**
 * Schema for URL validation (avatar, website)
 * Validates URL format and protocols
 */
export const UrlValidationSchema = z.string()
  .url('Invalid URL format')
  .max(2048, 'URL must not exceed 2048 characters')
  .optional()
  .nullable();