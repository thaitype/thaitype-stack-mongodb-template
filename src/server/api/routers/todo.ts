import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';

/**
 * tRPC router for Todo operations
 * All operations require authentication and are user-scoped for security
 */
export const todoRouter = createTRPCRouter({
  /**
   * Get all todos for the authenticated user
   */
  getAll: protectedProcedure
    .input(z.object({
      includeCompleted: z.boolean().optional().default(true),
      limit: z.number().min(1).max(100).optional(),
      skip: z.number().min(0).optional(),
    }).optional().default({ includeCompleted: true }))
    .query(async ({ ctx, input }) => {
      try {
        const todoService = ctx.container.todoService;
        const userId = ctx.session!.user.id;

        const todos = await todoService.getTodos(userId, {
          includeCompleted: input.includeCompleted,
          limit: input.limit,
          skip: input.skip,
        });

        return {
          todos,
          count: todos.length,
        };
      } catch (error) {
        ctx.container.appContext.logger.error('Failed to fetch todos', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.session!.user.id,
          input,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch todos',
          cause: error,
        });
      }
    }),

  /**
   * Get a single todo by ID
   */
  getById: protectedProcedure
    .input(z.object({
      id: z.string().min(1, 'Todo ID is required'),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const todoService = ctx.container.todoService;
        const userId = ctx.session!.user.id;

        const todo = await todoService.getTodoById(input.id, userId);
        
        if (!todo) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Todo not found or not accessible',
          });
        }

        return { todo };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        ctx.container.appContext.logger.error('Failed to fetch todo by ID', {
          error: error instanceof Error ? error.message : String(error),
          todoId: input.id,
          userId: ctx.session!.user.id,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch todo',
          cause: error,
        });
      }
    }),

  /**
   * Create a new todo
   */
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
      description: z.string().max(1000, 'Description too long').optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const todoService = ctx.container.todoService;
        const userId = ctx.session!.user.id;

        const todo = await todoService.createTodo(userId, {
          title: input.title,
          description: input.description,
        });

        return { 
          todo,
          message: 'Todo created successfully'
        };
      } catch (error) {
        ctx.container.appContext.logger.error('Failed to create todo', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.session!.user.id,
          title: input.title,
        });

        // Handle validation errors
        if (error instanceof Error && error.message.includes('ValidationError')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create todo',
          cause: error,
        });
      }
    }),

  /**
   * Update an existing todo
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string().min(1, 'Todo ID is required'),
      title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
      description: z.string().max(1000, 'Description too long').optional(),
      completed: z.boolean().optional(),
    }).refine(data => 
      data.title !== undefined || data.description !== undefined || data.completed !== undefined,
      'At least one field must be provided for update'
    ))
    .mutation(async ({ ctx, input }) => {
      try {
        const todoService = ctx.container.todoService;
        const userId = ctx.session!.user.id;

        await todoService.updateTodo(input.id, userId, {
          title: input.title,
          description: input.description,
          completed: input.completed,
        });

        return { 
          message: 'Todo updated successfully'
        };
      } catch (error) {
        ctx.container.appContext.logger.error('Failed to update todo', {
          error: error instanceof Error ? error.message : String(error),
          todoId: input.id,
          userId: ctx.session!.user.id,
        });

        // Handle not found errors
        if (error instanceof Error && error.message.includes('not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Todo not found or not accessible',
            cause: error,
          });
        }

        // Handle validation errors
        if (error instanceof Error && error.message.includes('ValidationError')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update todo',
          cause: error,
        });
      }
    }),

  /**
   * Toggle completion status of a todo
   */
  toggle: protectedProcedure
    .input(z.object({
      id: z.string().min(1, 'Todo ID is required'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const todoService = ctx.container.todoService;
        const userId = ctx.session!.user.id;

        const updatedTodo = await todoService.toggleTodo(input.id, userId);

        return { 
          todo: updatedTodo,
          message: `Todo marked as ${updatedTodo.completed ? 'completed' : 'pending'}`
        };
      } catch (error) {
        ctx.container.appContext.logger.error('Failed to toggle todo', {
          error: error instanceof Error ? error.message : String(error),
          todoId: input.id,
          userId: ctx.session!.user.id,
        });

        // Handle not found errors
        if (error instanceof Error && error.message.includes('not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Todo not found or not accessible',
            cause: error,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to toggle todo',
          cause: error,
        });
      }
    }),

  /**
   * Delete a todo
   */
  delete: protectedProcedure
    .input(z.object({
      id: z.string().min(1, 'Todo ID is required'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const todoService = ctx.container.todoService;
        const userId = ctx.session!.user.id;

        await todoService.deleteTodo(input.id, userId);

        return { 
          message: 'Todo deleted successfully'
        };
      } catch (error) {
        ctx.container.appContext.logger.error('Failed to delete todo', {
          error: error instanceof Error ? error.message : String(error),
          todoId: input.id,
          userId: ctx.session!.user.id,
        });

        // Handle not found errors
        if (error instanceof Error && error.message.includes('not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Todo not found or not accessible',
            cause: error,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete todo',
          cause: error,
        });
      }
    }),

  /**
   * Get statistics for user's todos
   */
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const todoService = ctx.container.todoService;
        const userId = ctx.session!.user.id;

        const stats = await todoService.getTodoStats(userId);

        return { stats };
      } catch (error) {
        ctx.container.appContext.logger.error('Failed to fetch todo statistics', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.session!.user.id,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch statistics',
          cause: error,
        });
      }
    }),
});