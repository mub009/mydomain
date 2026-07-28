import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  // Outgoing email. Without SMTP_HOST, emails are logged instead of sent.
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  MAIL_FROM: z.string().default("Markkito <no-reply@markkito.com>"),

  // WhatsApp broadcasts. "log" records what would be sent without touching
  // WhatsApp — the default, so a dev machine never links a real account by
  // accident. "webjs" drives a real linked handset via whatsapp-web.js.
  WHATSAPP_TRANSPORT: z.enum(["log", "webjs"]).default("log"),
  // Where whatsapp-web.js keeps each linked session. Must survive restarts,
  // or every shop has to re-scan a QR code after a deploy.
  WHATSAPP_SESSION_DIR: z.string().default(".whatsapp-sessions"),
  // Chromium for whatsapp-web.js. Blank lets Puppeteer find its own.
  WHATSAPP_CHROMIUM_PATH: z.string().optional().default(""),
  // Pause between two messages in the same campaign. Sending a burst is the
  // fastest way to get a number flagged, so this is deliberately unhurried.
  WHATSAPP_SEND_DELAY_MS: z.coerce.number().min(1000).default(8000),
  // Extra random jitter added to that pause, so the gap is not machine-regular.
  WHATSAPP_SEND_JITTER_MS: z.coerce.number().min(0).default(4000),
  // Ceiling per business per calendar day.
  WHATSAPP_DAILY_LIMIT: z.coerce.number().min(1).default(250),

  // Poster Studio copywriting. "offline" is a built-in phrase bank that needs
  // no account — the default, so posters work out of the box. "claude" calls
  // the Anthropic API and falls back to the phrase bank if the call fails.
  POSTER_AI_PROVIDER: z.enum(["offline", "claude"]).default("offline"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  POSTER_AI_MODEL: z.string().default("claude-opus-5"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
