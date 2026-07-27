import fs from "node:fs";
import path from "node:path";
import { WhatsappStatus } from "@prisma/client";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { prisma } from "@/config/database";
import { toWhatsappId } from "./phone";

/**
 * How the rest of the app talks to WhatsApp. Everything above this line deals
 * in businesses and messages; only the implementations below know that the
 * delivery mechanism is a browser driving WhatsApp Web.
 *
 * Two implementations:
 *  - `log`   records what would have been sent. The default, so a dev machine
 *            never links a real account by accident and the tests do not need
 *            a phone.
 *  - `webjs` drives a real linked handset through whatsapp-web.js.
 */
export interface WhatsAppTransport {
  /** Begin linking. Emits a QR the shop scans with their phone. */
  connect(businessId: string): Promise<void>;
  /** Drop the link and forget the stored session. */
  disconnect(businessId: string): Promise<void>;
  /** True when this business can send right now. */
  isReady(businessId: string): boolean;
  sendText(businessId: string, phone: string, body: string): Promise<void>;
}

// Session state is written straight to the row the dashboard polls, so the
// transport has no callbacks to wire up.
async function setSession(
  businessId: string,
  data: {
    status?: WhatsappStatus;
    qrDataUrl?: string | null;
    phoneNumber?: string | null;
    lastError?: string | null;
    connectedAt?: Date | null;
  },
): Promise<void> {
  await prisma.whatsappSession.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  });
}

// ---------------------------------------------------------------------------
// log transport
// ---------------------------------------------------------------------------

class LogTransport implements WhatsAppTransport {
  private ready = new Set<string>();

  async connect(businessId: string): Promise<void> {
    this.ready.add(businessId);
    await setSession(businessId, {
      status: WhatsappStatus.CONNECTED,
      qrDataUrl: null,
      phoneNumber: "log-transport",
      lastError: null,
      connectedAt: new Date(),
    });
    logger.info({ businessId }, "whatsapp: log transport connected (nothing is really sent)");
  }

  async disconnect(businessId: string): Promise<void> {
    this.ready.delete(businessId);
    await setSession(businessId, {
      status: WhatsappStatus.DISCONNECTED,
      qrDataUrl: null,
      phoneNumber: null,
      connectedAt: null,
    });
  }

  isReady(businessId: string): boolean {
    return this.ready.has(businessId);
  }

  async sendText(businessId: string, phone: string, body: string): Promise<void> {
    if (!this.ready.has(businessId)) throw new Error("WhatsApp is not connected for this business");
    logger.info({ businessId, phone, preview: body.slice(0, 80) }, "whatsapp: would send");
  }
}

// ---------------------------------------------------------------------------
// whatsapp-web.js transport
// ---------------------------------------------------------------------------

/**
 * Checks the browser before Puppeteer does, so a misconfigured path fails with
 * the command that fixes it rather than a bare "Browser was not found".
 *
 * The install deliberately skips Puppeteer's bundled Chromium download, so a
 * fresh checkout has no browser at all until someone provides one.
 */
function assertChromiumIsUsable(): void {
  const configured = env.WHATSAPP_CHROMIUM_PATH.trim();

  if (!configured) {
    // Empty means "let Puppeteer find its own", which only works once its
    // browser has been installed. Puppeteer's own error covers that case
    // clearly, so there is nothing useful to add here.
    return;
  }

  if (!fs.existsSync(configured)) {
    throw new Error(
      `WHATSAPP_CHROMIUM_PATH points at "${configured}", but there is no file there.\n` +
        "Either run `npx puppeteer browsers install chrome` in the backend and leave " +
        "WHATSAPP_CHROMIUM_PATH empty, or set it to a browser that exists — find one with " +
        "`which chromium chromium-browser google-chrome google-chrome-stable`.",
    );
  }

  try {
    fs.accessSync(configured, fs.constants.X_OK);
  } catch {
    throw new Error(`WHATSAPP_CHROMIUM_PATH points at "${configured}", but that file is not executable.`);
  }
}

interface WebJsClient {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  logout(): Promise<void>;
  sendMessage(chatId: string, body: string): Promise<unknown>;
  on(event: string, handler: (...args: never[]) => void): void;
  getNumberId(number: string): Promise<{ _serialized: string } | null>;
  info?: { wid?: { user?: string } };
}

class WebJsTransport implements WhatsAppTransport {
  private clients = new Map<string, WebJsClient>();
  private ready = new Set<string>();
  // Guards against two requests racing to initialise the same client.
  private starting = new Map<string, Promise<void>>();

  async connect(businessId: string): Promise<void> {
    const existing = this.starting.get(businessId);
    if (existing) return existing;
    if (this.ready.has(businessId)) return;

    const startup = this.start(businessId).finally(() => this.starting.delete(businessId));
    this.starting.set(businessId, startup);
    return startup;
  }

  private async start(businessId: string): Promise<void> {
    assertChromiumIsUsable();

    // Imported lazily: whatsapp-web.js spawns a browser on load, which no
    // deployment should pay for unless a shop is actually linking an account.
    //
    // Both packages are CommonJS. Node's named-export detection finds `Client`
    // on the namespace but not `LocalAuth`, so destructuring the namespace
    // yields `undefined` for it and fails with "LocalAuth is not a
    // constructor". Everything is present on `default`, so read from there.
    const wwebjs = await import("whatsapp-web.js");
    const { Client, LocalAuth } = (wwebjs as unknown as { default?: typeof wwebjs }).default ?? wwebjs;
    const qrcodeModule = await import("qrcode");
    const QRCode = (qrcodeModule as unknown as { default?: typeof qrcodeModule }).default ?? qrcodeModule;

    const client = new Client({
      // One session directory per business, so shops never share a login.
      authStrategy: new LocalAuth({
        clientId: businessId,
        dataPath: path.resolve(env.WHATSAPP_SESSION_DIR),
      }),
      puppeteer: {
        headless: true,
        ...(env.WHATSAPP_CHROMIUM_PATH ? { executablePath: env.WHATSAPP_CHROMIUM_PATH } : {}),
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      },
    }) as unknown as WebJsClient;

    client.on("qr", ((qr: string) => {
      QRCode.toDataURL(qr, { errorCorrectionLevel: "M", margin: 1, width: 320 })
        .then((qrDataUrl) =>
          setSession(businessId, { status: WhatsappStatus.AWAITING_SCAN, qrDataUrl, lastError: null }),
        )
        .catch((err) => logger.error({ err, businessId }, "whatsapp: could not render QR"));
    }) as never);

    client.on("ready", (() => {
      this.ready.add(businessId);
      void setSession(businessId, {
        status: WhatsappStatus.CONNECTED,
        qrDataUrl: null,
        phoneNumber: client.info?.wid?.user ?? null,
        lastError: null,
        connectedAt: new Date(),
      });
      logger.info({ businessId }, "whatsapp: connected");
    }) as never);

    client.on("auth_failure", ((message: string) => {
      this.ready.delete(businessId);
      void setSession(businessId, {
        status: WhatsappStatus.DISCONNECTED,
        qrDataUrl: null,
        lastError: `Sign-in failed: ${message}`,
      });
    }) as never);

    client.on("disconnected", ((reason: string) => {
      this.ready.delete(businessId);
      this.clients.delete(businessId);
      void setSession(businessId, {
        status: WhatsappStatus.DISCONNECTED,
        qrDataUrl: null,
        connectedAt: null,
        lastError: `Disconnected: ${reason}`,
      });
      logger.warn({ businessId, reason }, "whatsapp: disconnected");
    }) as never);

    this.clients.set(businessId, client);

    try {
      await client.initialize();
    } catch (err) {
      this.clients.delete(businessId);
      this.ready.delete(businessId);
      const message = err instanceof Error ? err.message : String(err);
      await setSession(businessId, { status: WhatsappStatus.DISCONNECTED, qrDataUrl: null, lastError: message });
      throw err;
    }
  }

  async disconnect(businessId: string): Promise<void> {
    const client = this.clients.get(businessId);
    this.ready.delete(businessId);
    this.clients.delete(businessId);

    if (client) {
      // logout clears the stored session so the next connect asks for a fresh
      // QR; destroy alone would leave the shop silently still linked.
      await client.logout().catch(() => undefined);
      await client.destroy().catch(() => undefined);
    }

    await setSession(businessId, {
      status: WhatsappStatus.DISCONNECTED,
      qrDataUrl: null,
      phoneNumber: null,
      connectedAt: null,
      lastError: null,
    });
  }

  isReady(businessId: string): boolean {
    return this.ready.has(businessId);
  }

  async sendText(businessId: string, phone: string, body: string): Promise<void> {
    const client = this.clients.get(businessId);
    if (!client || !this.ready.has(businessId)) {
      throw new Error("WhatsApp is not connected for this business");
    }

    // Not every number has a WhatsApp account. Checking first turns a silent
    // black hole into a per-recipient error the shop can see.
    const resolved = await client.getNumberId(phone);
    if (!resolved) throw new Error("This number is not on WhatsApp");

    await client.sendMessage(resolved._serialized ?? toWhatsappId(phone), body);
  }
}

let instance: WhatsAppTransport | null = null;

export function whatsappTransport(): WhatsAppTransport {
  if (!instance) {
    instance = env.WHATSAPP_TRANSPORT === "webjs" ? new WebJsTransport() : new LogTransport();
    logger.info({ transport: env.WHATSAPP_TRANSPORT }, "whatsapp transport selected");
  }
  return instance;
}

/** Test seam: swaps the transport and returns a restore function. */
export function __setTransport(next: WhatsAppTransport | null): void {
  instance = next;
}
