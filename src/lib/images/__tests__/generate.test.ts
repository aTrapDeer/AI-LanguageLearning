import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildImageRequest, describeImageError, normalisePicture, requestPicture, TARGET_IMAGE_BYTES, type ImageApiClient } from "../generate";

const ENV_KEYS = ["OPENAI_IMAGE_MODEL", "OPENAI_IMAGE_QUALITY", "OPENAI_IMAGE_SIZE", "OPENAI_IMAGE_COMPLEXITY"] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

/** A 1024² flat illustration (shapes, gradient, outline), like what the Images API returns. */
async function picture(format: "png" | "jpeg"): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdf2e9"/><stop offset="1" stop-color="#e8f4fd"/></linearGradient></defs>
    <rect width="1024" height="1024" fill="url(#g)"/>
    <circle cx="512" cy="560" r="300" fill="#e74c3c" stroke="#7b241c" stroke-width="18"/>
    <ellipse cx="420" cy="460" rx="70" ry="40" fill="#f5b7b1"/>
    <path d="M512 270 C 530 180, 600 150, 650 160" stroke="#6e2c00" stroke-width="28" fill="none"/>
    <ellipse cx="610" cy="220" rx="80" ry="36" fill="#27ae60" transform="rotate(-25 610 220)"/>
  </svg>`;
  const image = sharp(Buffer.from(svg));
  return format === "png" ? image.png().toBuffer() : image.jpeg().toBuffer();
}

/** Worst case: pure noise does not compress. */
async function noise(): Promise<Buffer> {
  const raw = Buffer.alloc(1024 * 1024 * 3);
  for (let index = 0; index < raw.length; index += 1) raw[index] = (index * 7919) % 251;
  return sharp(raw, { raw: { width: 1024, height: 1024, channels: 3 } }).png().toBuffer();
}

function fakeClient(reply: { b64_json?: string; url?: string } | Error) {
  const calls: Array<{ body: Record<string, unknown>; options: unknown }> = [];
  const client: ImageApiClient = {
    images: {
      generate: vi.fn(async (body, options) => {
        calls.push({ body, options });
        if (reply instanceof Error) throw reply;
        return { data: [reply] };
      }),
    },
  };
  return { client, calls };
}

describe("buildImageRequest", () => {
  it("sends the documented fields with low-cost defaults", () => {
    const body = buildImageRequest("a red apple");
    expect(Object.keys(body).sort()).toEqual(["complexity", "model", "n", "output_format", "prompt", "quality", "size"]);
    expect(body).toMatchObject({
      model: "gpt-image-2.6-flare",
      size: "1024x1024",
      quality: "low",
      complexity: "low",
      output_format: "jpeg",
      n: 1,
    });
    expect(body.prompt).toContain("a red apple");
  });

  it("leaves complexity out for other models and when switched off", () => {
    process.env.OPENAI_IMAGE_MODEL = "some-other-image-model";
    expect(buildImageRequest("a dog")).not.toHaveProperty("complexity");
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2.6-flare";
    process.env.OPENAI_IMAGE_COMPLEXITY = "off";
    expect(buildImageRequest("a dog")).not.toHaveProperty("complexity");
  });

  it("takes overrides from env", () => {
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2.6-sunburst";
    process.env.OPENAI_IMAGE_QUALITY = "medium";
    process.env.OPENAI_IMAGE_SIZE = "1536x1024";
    process.env.OPENAI_IMAGE_COMPLEXITY = "medium";
    expect(buildImageRequest("a dog")).toMatchObject({
      model: "gpt-image-2.6-sunburst",
      quality: "medium",
      size: "1536x1024",
      complexity: "medium",
    });
  });

  it("ignores a malformed size", () => {
    process.env.OPENAI_IMAGE_SIZE = "huge";
    expect(buildImageRequest("a dog").size).toBe("1024x1024");
  });
});

describe("requestPicture", () => {
  it("accepts b64_json in PNG or JPEG and never retries inside the request", async () => {
    for (const format of ["png", "jpeg"] as const) {
      const source = await picture(format);
      const { client, calls } = fakeClient({ b64_json: source.toString("base64") });
      const bytes = await requestPicture("a red apple", { client });
      expect(Buffer.from(bytes).equals(source)).toBe(true);
      expect(calls[0].options).toMatchObject({ maxRetries: 0 });
    }
  });

  it("downloads a url response server-side", async () => {
    const source = await picture("jpeg");
    const { client } = fakeClient({ url: "https://images.example/abc.jpg" });
    const fetchImpl = vi.fn(async () => new Response(source, { status: 200 })) as unknown as typeof fetch;
    const bytes = await requestPicture("a red apple", { client, fetchImpl });
    expect(Buffer.from(bytes).equals(source)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith("https://images.example/abc.jpg", expect.anything());
  });

  it("fails on empty responses, non-images and API errors", async () => {
    await expect(requestPicture("x", { client: fakeClient({}).client })).rejects.toThrow(/no image/);
    await expect(
      requestPicture("x", { client: fakeClient({ b64_json: Buffer.from("<html>").toString("base64") }).client })
    ).rejects.toThrow(/not a PNG/);
    const apiError = Object.assign(new Error("400 Unknown parameter: 'complexity'."), { status: 400 });
    await expect(requestPicture("x", { client: fakeClient(apiError).client })).rejects.toThrow(/Unknown parameter/);
    expect(describeImageError(apiError)).toBe("400 Unknown parameter: 'complexity'.");
  });
});

describe("normalisePicture", () => {
  it("stores a 512px square WebP within the size budget, whatever came in", async () => {
    for (const format of ["png", "jpeg"] as const) {
      const result = await normalisePicture(await picture(format));
      expect(result.mimeType).toBe("image/webp");
      expect([result.width, result.height]).toEqual([512, 512]);
      expect(result.data.byteLength).toBeLessThanOrEqual(TARGET_IMAGE_BYTES);
      expect((await sharp(result.data).metadata()).format).toBe("webp");
    }
  });

  it("still stores incompressible input, at the lowest quality step", async () => {
    const result = await normalisePicture(await noise());
    expect([result.width, result.height]).toEqual([512, 512]);
    expect((await sharp(result.data).metadata()).format).toBe("webp");
  });

  it("rejects bytes that are not an image", async () => {
    await expect(normalisePicture(new TextEncoder().encode("not an image"))).rejects.toThrow();
  });
});
