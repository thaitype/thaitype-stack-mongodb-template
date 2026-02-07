import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { MongoClient } from 'mongodb';
import { env } from '~/env';
import { initializeDatabaseConfig } from './db';

// Initialize database configuration for auth hooks
initializeDatabaseConfig(
  {
    uri: env.MONGODB_URI,
    name: env.DB_NAME,
  },
  env.NODE_ENV
);

// Lazy initialize MongoDB connection for Better Auth
let mongoClient: MongoClient | null = null;
let authInstance: ReturnType<typeof betterAuth> | null = null;

async function initializeAuth() {
  if (authInstance) {
    return authInstance;
  }

  if (!mongoClient) {
    mongoClient = new MongoClient(env.MONGODB_URI);
    await mongoClient.connect();
  }

  const db = mongoClient.db(env.DB_NAME);

  authInstance = betterAuth({
    database: mongodbAdapter(db),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Set to true in production
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
    user: {
      additionalFields: {
        // Additional fields for Monguard compatibility
        roles: {
          type: 'string[]',
          required: false,
          defaultValue: ['admin'],
          input: true, // Allow roles to be set programmatically
        },
        // Better Auth does not support ObjectId types directly,
        // Monguard auto-fields (managed by hooks)
      },
    },
    databaseHooks: {
      user: {
        // create: {
        //   after: handleUserCreate
        // },
        // update: {
        //   after: handleUserUpdate
        // },
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.NEXT_PUBLIC_BETTER_AUTH_URL,
    trustedOrigins: [env.NEXT_PUBLIC_BETTER_AUTH_URL],
    advanced: {
      // https://www.better-auth.com/docs/integrations/hono#cross-domain-cookies
      // TODO: Enable this if you need cross-domain cookies
      // This is useful if your frontend and backend are on different subdomains
      // In the production, I'll disable this
      crossSubDomainCookies: {
        enabled: true
      }
    }
  });

  return authInstance;
}

// Export getAuth function to lazily initialize
export async function getAuth() {
  return initializeAuth();
}
