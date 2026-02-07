import { getAuth } from "~/server/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Get auth instance and create handler
const getHandler = async () => {
  const auth = await getAuth();
  return toNextJsHandler(auth.handler);
};

// Create dynamic route handlers
export const GET = async (request: Request) => {
  const { GET } = await getHandler();
  return GET(request);
};

export const POST = async (request: Request) => {
  const { POST } = await getHandler();
  return POST(request);
};

// Mark this route as dynamic to prevent build-time database connection attempts
export const dynamic = "force-dynamic";