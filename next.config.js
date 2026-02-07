/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  serverExternalPackages: [
    'pino',          // the logger itself
    'pino-pretty',   // pretty transport you use in dev
    'thread-stream'  // the Worker wrapper
  ],
  // Don't prerender dynamic API routes that require database connections
  skipMiddlewareUrlNormalize: undefined,
};

export default config;
