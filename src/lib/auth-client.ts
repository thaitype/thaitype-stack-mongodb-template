import { createAuthClient } from "better-auth/react";
import { env } from "~/env";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  resetPassword,
} = authClient;