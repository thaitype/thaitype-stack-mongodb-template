/**
 * MongoDB User Repository - Entity-Based Architecture
 * 
 * This implementation follows the definitive repository design rules:
 * 1. Repository methods accept clear entity subset types (not unknown)
 * 2. Validation happens inside repository using Zod schemas
 * 3. Schema output must match input type exactly using matches<T>()
 * 4. ObjectId conversion handled in schemas or parseObjectId() method
 * 5. Explicit MongoDB operations, no buildMongoUpdate
 * 6. Consistent naming convention
 */

import type { AppContext } from '~/server/context/app-context';
import type { CreateUserRequest, IUserRepository, User } from '~/server/domain';
import type { DbUserEntity } from '~/server/infrastructure/entities';
import type { RepositoryContext } from '~/server/lib/constants';
import { isValidObjectId } from '~/server/lib/constants';
import { ObjectId, type Db, type Filter } from 'mongodb';
import { BaseMongoRepository } from './base-mongo-repository';
import { authUserAPI } from '~/server/lib/auth-api';
import * as Err from '~/server/lib/errors/domain-errors';

// Import validation schemas
import {
  RepoUserCreateSchema,
  RepoUserBasicInfoUpdateSchema,
  RepoUserRolesUpdateSchema,
  RepoUserEmailUpdateSchema,
  RepoUserStatusUpdateSchema,
  RepoUserProfileUpdateSchema,
  RepoUserNameUpdateSchema,
  RepoUserBioUpdateSchema,
  RepoUserAvatarUpdateSchema,
  RepoUserWebsiteUpdateSchema,
} from '~/server/domain/repositories/schemas/user-repository-schemas';

// Import repository types
import type {
  UserCreateRequest,
  UserBasicInfoPartialUpdate,
  UserRolesUpdate,
  UserEmailUpdate,
  UserStatusUpdate,
  UserProfilePartialUpdate,
  UserNameUpdate,
  UserBioUpdate,
  UserAvatarUpdate,
  UserWebsiteUpdate,
} from '~/server/domain/repositories/types/user-repository-types';

export class MongoUserRepository extends BaseMongoRepository<DbUserEntity> implements IUserRepository {
  constructor(private appContext: AppContext, db: Db) {
    super(db, 'user',{
      monguardOptions: {
        enableAuditLogging: true,
      },
    }); // Changed from 'users' to 'user'
  }

  protected getLogger() {
    return this.appContext.logger;
  }

  /**
   * Centralized ObjectId parsing with validation
   * Provides consistent error handling across all repository methods
   */
  private parseObjectId(id: string): ObjectId {
    if (!isValidObjectId(id)) {
      throw new Err.ValidationError(`Invalid ObjectId format: ${id}. Expected 24-character hex string.`, {
        objectId: id,
        expectedFormat: '24-character hex string'
      });
    }
    return new ObjectId(id);
  }

  // Helper to convert Better Auth User to domain User
  private toDomainUser(authUser: DbUserEntity): User {
    return {
      id: (authUser._id as ObjectId)?.toString() ?? '',
      email: authUser.email,
      name: authUser.name,
      roles: authUser.roles || ['admin'],
      bio: authUser.bio,
      avatar: authUser.avatar,
      website: authUser.website,
      isActive: !authUser.deletedAt, // Active if not soft deleted
      createdAt: authUser.createdAt, // Monguard guarantees this exists
      updatedAt: authUser.updatedAt, // Monguard guarantees this exists
    };
  }

  // Helper to convert domain requests to database format for create operations
  private toDbData(data: CreateUserRequest): Partial<DbUserEntity> {
    return { ...data };
  }

  async create(input: UserCreateRequest, _context: RepositoryContext): Promise<User> {
    try {
      this.appContext.logger.info('Creating user in repository', {
        email: input.email,
        name: input.name,
        roles: input.roles,
        operation: 'create',
        repository: 'MongoUserRepository'
      });

      // ✅ Validation happens here in repository
      const validatedData = RepoUserCreateSchema.parse(input);

      // Use Better Auth API for user creation
      // Note: Better Auth requires password, but domain doesn't provide it
      // This might need to be handled at the service layer instead
      const authUser = await authUserAPI.createUser({
        email: validatedData.email,
        password: 'temp-password-needs-reset', // Temporary password - user should reset
        name: validatedData.name,
        roles: validatedData.roles || ['admin'],
        bio: validatedData.bio,
        avatar: validatedData.avatar,
        website: validatedData.website,
      });

      this.appContext.logger.info('User created successfully in repository', {
        userId: (authUser._id as ObjectId)?.toString(),
        email: validatedData.email,
        operation: 'create'
      });
      
      return this.toDomainUser(authUser);
    } catch (error) {
      this.appContext.logger.error('User creation failed in repository', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        email: input.email,
        operation: 'create',
        repository: 'MongoUserRepository'
      });
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    // Use Better Auth API for user lookup
    const authUser = await authUserAPI.getUserById(id);
    return authUser ? this.toDomainUser(authUser) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    // Use Better Auth API for email lookup
    const authUser = await authUserAPI.getUserByEmail(email);
    return authUser ? this.toDomainUser(authUser) : null;
  }

  // =============================================================================
  // DEDICATED UPDATE METHODS (No generic update!)
  // =============================================================================

  async updateBasicInfo(id: string, input: UserBasicInfoPartialUpdate, context: RepositoryContext): Promise<void> {
    try {
      this.appContext.logger.info('Updating user basic info', {
        userId: id,
        operation: 'updateBasicInfo',
        repository: 'MongoUserRepository'
      });

      // ✅ Validation happens here in repository
      const validatedData = RepoUserBasicInfoUpdateSchema.parse(input);
      
      // Explicit MongoDB operation following architecture standards
      await this.collection.updateById(
        this.parseObjectId(id),
        { $set: validatedData },
        { userContext: this.resolveUserContext(context) }
      );

      this.appContext.logger.info('User basic info updated successfully', {
        userId: id,
        operation: 'updateBasicInfo'
      });
    } catch (error) {
      this.appContext.logger.error('User basic info update failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: id,
        operation: 'updateBasicInfo',
        repository: 'MongoUserRepository'
      });
      throw error;
    }
  }

  async updateRoles(id: string, input: UserRolesUpdate, context: RepositoryContext): Promise<void> {
    try {
      this.appContext.logger.info('Updating user roles', {
        userId: id,
        roles: input.roles,
        operation: 'updateRoles',
        repository: 'MongoUserRepository'
      });

      // ✅ Validation happens here in repository
      const validatedData = RepoUserRolesUpdateSchema.parse(input);
      
      await this.collection.updateById(
        this.parseObjectId(id),
        { $set: validatedData },
        { userContext: this.resolveUserContext(context) }
      );

      this.appContext.logger.info('User roles updated successfully', {
        userId: id,
        roles: validatedData.roles,
        operation: 'updateRoles'
      });
    } catch (error) {
      this.appContext.logger.error('User roles update failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: id,
        operation: 'updateRoles',
        repository: 'MongoUserRepository'
      });
      throw error;
    }
  }

  async updateEmail(id: string, input: UserEmailUpdate, context: RepositoryContext): Promise<void> {
    try {
      this.appContext.logger.info('Updating user email', {
        userId: id,
        operation: 'updateEmail',
        repository: 'MongoUserRepository'
      });

      // ✅ Validation happens here in repository
      const validatedData = RepoUserEmailUpdateSchema.parse(input);
      
      await this.collection.updateById(
        this.parseObjectId(id),
        { $set: validatedData },
        { userContext: this.resolveUserContext(context) }
      );

      this.appContext.logger.info('User email updated successfully', {
        userId: id,
        operation: 'updateEmail'
      });
    } catch (error) {
      this.appContext.logger.error('User email update failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: id,
        operation: 'updateEmail',
        repository: 'MongoUserRepository'
      });
      throw error;
    }
  }

  async updateStatus(id: string, input: UserStatusUpdate, context: RepositoryContext): Promise<void> {
    try {
      this.appContext.logger.info('Updating user status', {
        userId: id,
        isActive: input.isActive,
        operation: 'updateStatus',
        repository: 'MongoUserRepository'
      });

      // ✅ Validation happens here in repository
      const validatedData = RepoUserStatusUpdateSchema.parse(input);
      
      await this.collection.updateById(
        this.parseObjectId(id),
        { $set: validatedData },
        { userContext: this.resolveUserContext(context) }
      );

      this.appContext.logger.info('User status updated successfully', {
        userId: id,
        isActive: validatedData.isActive,
        operation: 'updateStatus'
      });
    } catch (error) {
      this.appContext.logger.error('User status update failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: id,
        operation: 'updateStatus',
        repository: 'MongoUserRepository'
      });
      throw error;
    }
  }

  async updateProfile(id: string, input: UserProfilePartialUpdate, context: RepositoryContext): Promise<User | null> {
    try {
      this.appContext.logger.info('Updating user profile', {
        userId: id,
        operation: 'updateProfile',
        repository: 'MongoUserRepository'
      });

      // ✅ Validation happens here in repository
      const validatedData = RepoUserProfileUpdateSchema.parse(input);
      
      // For profile updates, if no context provided, assume it's a self-update
      const userContext = context?.operatedBy 
        ? this.resolveUserContext(context)
        : this.createUserContext(id); // Self-update

      await this.collection.updateById(
        this.parseObjectId(id),
        { $set: validatedData },
        { userContext }
      );

      this.appContext.logger.info('User profile updated successfully', {
        userId: id,
        operation: 'updateProfile'
      });

      // Return the updated user
      return await this.findById(id);
    } catch (error) {
      this.appContext.logger.error('User profile update failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: id,
        operation: 'updateProfile',
        repository: 'MongoUserRepository'
      });
      throw error;
    }
  }

  async updateName(id: string, input: UserNameUpdate, context: RepositoryContext): Promise<void> {
    try {
      this.appContext.logger.info('Updating user name', {
        userId: id,
        operation: 'updateName',
        repository: 'MongoUserRepository'
      });

      // ✅ Validation happens here in repository
      const validatedData = RepoUserNameUpdateSchema.parse(input);
      
      await this.collection.updateById(
        this.parseObjectId(id),
        { $set: validatedData },
        { userContext: this.resolveUserContext(context) }
      );

      this.appContext.logger.info('User name updated successfully', {
        userId: id,
        operation: 'updateName'
      });
    } catch (error) {
      this.appContext.logger.error('User name update failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: id,
        operation: 'updateName',
        repository: 'MongoUserRepository'
      });
      throw error;
    }
  }

  async updateBio(id: string, input: UserBioUpdate, context: RepositoryContext): Promise<void> {
    try {
      this.appContext.logger.info('Updating user bio', {
        userId: id,
        operation: 'updateBio',
        repository: 'MongoUserRepository'
      });

      // ✅ Validation happens here in repository
      const validatedData = RepoUserBioUpdateSchema.parse(input);
      
      await this.collection.updateById(
        this.parseObjectId(id),
        { $set: validatedData },
        { userContext: this.resolveUserContext(context) }
      );

      this.appContext.logger.info('User bio updated successfully', {
        userId: id,
        operation: 'updateBio'
      });
    } catch (error) {
      this.appContext.logger.error('User bio update failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: id,
        operation: 'updateBio',
        repository: 'MongoUserRepository'
      });
      throw error;
    }
  }

  async updateAvatar(id: string, input: UserAvatarUpdate, context: RepositoryContext): Promise<void> {
    try {
      this.appContext.logger.info('Updating user avatar', {
        userId: id,
        operation: 'updateAvatar',
        repository: 'MongoUserRepository'
      });

      // ✅ Validation happens here in repository
      const validatedData = RepoUserAvatarUpdateSchema.parse(input);
      
      await this.collection.updateById(
        this.parseObjectId(id),
        { $set: validatedData },
        { userContext: this.resolveUserContext(context) }
      );

      this.appContext.logger.info('User avatar updated successfully', {
        userId: id,
        operation: 'updateAvatar'
      });
    } catch (error) {
      this.appContext.logger.error('User avatar update failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: id,
        operation: 'updateAvatar',
        repository: 'MongoUserRepository'
      });
      throw error;
    }
  }

  async updateWebsite(id: string, input: UserWebsiteUpdate, context: RepositoryContext): Promise<void> {
    try {
      this.appContext.logger.info('Updating user website', {
        userId: id,
        operation: 'updateWebsite',
        repository: 'MongoUserRepository'
      });

      // ✅ Validation happens here in repository
      const validatedData = RepoUserWebsiteUpdateSchema.parse(input);
      
      await this.collection.updateById(
        this.parseObjectId(id),
        { $set: validatedData },
        { userContext: this.resolveUserContext(context) }
      );

      this.appContext.logger.info('User website updated successfully', {
        userId: id,
        operation: 'updateWebsite'
      });
    } catch (error) {
      this.appContext.logger.error('User website update failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: id,
        operation: 'updateWebsite',
        repository: 'MongoUserRepository'
      });
      throw error;
    }
  }


  async delete(id: string, context: RepositoryContext): Promise<void> {
    try {
      this.appContext.logger.info('Deleting user', {
        userId: id,
        operation: 'delete',
        repository: 'MongoUserRepository'
      });

      // Use Monguard's soft delete - it automatically handles deletedAt and updatedAt timestamps
      await this.collection.deleteById(
        this.parseObjectId(id),
        {
          userContext: this.resolveUserContext(context),
        }
      );

      this.appContext.logger.info('User deleted successfully', {
        userId: id,
        operation: 'delete'
      });
    } catch (error) {
      this.appContext.logger.error('User deletion failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: id,
        operation: 'delete',
        repository: 'MongoUserRepository'
      });
      throw error;
    }
  }

  async findAll(
    filter: Partial<User> = {},
    options: {
      limit?: number;
      skip?: number;
      sort?: Record<string, 1 | -1>;
    } = {}
  ): Promise<User[]> {
    // Convert domain filter to database filter
    const dbFilter: Filter<DbUserEntity> = {};
    if (filter.email) dbFilter.email = filter.email;
    if (filter.roles && filter.roles.length > 0) dbFilter.roles = { $in: filter.roles };
    
    // Handle isActive filter (map to deletedAt existence)
    if (filter.isActive === true) {
      dbFilter.deletedAt = { $exists: false } as { $exists: boolean };
    } else if (filter.isActive === false) {
      dbFilter.deletedAt = { $exists: true } as { $exists: boolean };
    }

    const results = await this.collection.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dbFilter as any
      , {
      limit: options.limit,
      skip: options.skip,
      sort: options.sort,
      includeSoftDeleted: filter.isActive === false, // Include soft deleted if looking for inactive users
    });

    return results.map((user) => this.toDomainUser(user));
  }

  async count(filter: Partial<User> = {}): Promise<number> {
    // Convert domain filter to database filter
    const dbFilter: Filter<DbUserEntity> = {};
    if (filter.email) dbFilter.email = filter.email;
    if (filter.roles && filter.roles.length > 0) dbFilter.roles = { $in: filter.roles };
    
    // Handle isActive filter (map to deletedAt existence)
    if (filter.isActive === true) {
      dbFilter.deletedAt = { $exists: false } as { $exists: boolean };
    } else if (filter.isActive === false) {
      dbFilter.deletedAt = { $exists: true } as { $exists: boolean };
    }

    return await this.collection.count(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dbFilter as any, 
      filter.isActive === false // Include soft deleted if looking for inactive users
    );
  }
}
