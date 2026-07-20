import pino from "pino";
import { env } from "./env";

// Plain structured (JSON) logging in every environment. A `transport` option
// spawns a worker thread that resolves its target module independently of
// the app's module loader, which is fragile under ts-node/tsx-style runtime
// transforms and some sandboxed hosts — not worth it for a "prettier" dev
// console. Pipe stdout through `pino-pretty` locally if you want that:
// `npm run dev | npx pino-pretty`.
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
});
