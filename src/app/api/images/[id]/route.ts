import { getConceptImageData } from "@/lib/database";
import { picturesEnabled } from "@/lib/images/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function empty(status: number, extra: Record<string, string> = {}) {
  return new Response(null, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

/**
 * GET /api/images/:id — a stored vocabulary picture (WebP). These are generic illustrations shared by
 * every learner, not user data, so no session is needed; ids are random UUIDs and only rows of the
 * concept_images table can be served. 202 while the picture is still being generated, 404 otherwise.
 */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!UUID.test(id ?? "") || !picturesEnabled()) {
      return empty(404);
    }

    const image = await getConceptImageData(id.toLowerCase());
    if (!image) {
      return empty(404);
    }
    if (image.status === "pending") {
      return empty(202, { "Retry-After": "3" });
    }
    if (image.status !== "ready" || !image.data || image.mimeType !== "image/webp") {
      return empty(404);
    }

    return new Response(image.data, {
      status: 200,
      headers: {
        "Content-Type": image.mimeType,
        "Content-Length": String(image.data.byteLength),
        // A row is never regenerated once it is ready, so its bytes never change.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[IMAGE_GET]", error);
    return empty(500);
  }
}
