import { env } from "@/config/env";
import { logger } from "@/config/logger";

/**
 * How a shop's finished poster gets made from the admin's master template.
 *
 * Two engines behind one interface, the same arrangement the WhatsApp
 * transport and the copywriter use:
 *
 * - **local** composites the template with that shop's own logo, name, number
 *   and QR. It costs nothing, returns instantly, needs no account, and every
 *   shop gets recognisably the same design — which is the point of a master
 *   template. This is the default.
 * - **openai** hands the template and the resolved prompt to an image model
 *   and takes back whatever it draws. That costs money per poster, takes
 *   seconds, and returns something different every run — including, sometimes,
 *   something that no longer looks like the admin's design.
 *
 * The local engine is not a fallback for the other; it is the better answer
 * for most posters, and the reason the image API is opt-in rather than
 * assumed.
 */

export type ImageEngineId = "local" | "openai";

export interface GeneratedImage {
  /** A data URI: SVG from the local engine, PNG from an image model. */
  image: string;
  engine: ImageEngineId;
  width: number;
  height: number;
  /** Set when the requested engine could not run and the local one did. */
  note?: string;
}

export interface GenerateInput {
  /** The admin's master template, as a data URI. */
  template: string | null;
  /** The design's prompt with this shop's details already filled in. */
  prompt: string;
  /** What the local engine produces, computed by the caller. */
  composited: { svg: string; width: number; height: number };
}

/** True when the image model is both selected and actually usable. */
export function openAiConfigured(): boolean {
  return env.POSTER_IMAGE_ENGINE === "openai" && env.OPENAI_API_KEY.length > 0;
}

function dataUriToFile(dataUri: string, name: string): File {
  const [header, body] = dataUri.split(",");
  const type = header.match(/data:([^;]+)/)?.[1] ?? "image/png";
  return new File([Buffer.from(body, "base64")], name, { type });
}

/**
 * Edits the master template rather than generating from nothing: the admin's
 * design is the starting point, so the result still belongs to it instead of
 * being a fresh picture that happens to share a prompt.
 */
async function generateWithOpenAi(input: GenerateInput): Promise<GeneratedImage> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  if (!input.template) throw new Error("This design has no template image to work from");

  const response = await client.images.edit({
    model: env.POSTER_IMAGE_MODEL,
    image: dataUriToFile(input.template, "template.png"),
    prompt: input.prompt,
    n: 1,
    size: "1024x1024",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("The image model returned no image");

  return { image: `data:image/png;base64,${b64}`, engine: "openai", width: 1024, height: 1024 };
}

function localImage(input: GenerateInput): GeneratedImage {
  return {
    image: `data:image/svg+xml;base64,${Buffer.from(input.composited.svg).toString("base64")}`,
    engine: "local",
    width: input.composited.width,
    height: input.composited.height,
  };
}

/**
 * Makes the poster, and says which engine actually made it.
 *
 * A failed image call falls back to compositing rather than to nothing: the
 * shop wanted a poster, and the local one is a real poster, not a placeholder.
 */
export async function generatePosterImage(input: GenerateInput): Promise<GeneratedImage> {
  if (env.POSTER_IMAGE_ENGINE !== "openai") return localImage(input);

  if (!env.OPENAI_API_KEY) {
    return {
      ...localImage(input),
      note: "POSTER_IMAGE_ENGINE is openai but OPENAI_API_KEY is not set — composited instead.",
    };
  }

  try {
    return await generateWithOpenAi(input);
  } catch (err) {
    logger.warn({ err }, "Poster image generation fell back to compositing");
    const reason = err instanceof Error ? err.message : "unknown error";
    return { ...localImage(input), note: `The image model could not be reached (${reason}) — composited instead.` };
  }
}
