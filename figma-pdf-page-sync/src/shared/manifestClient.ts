import { DEFAULT_MANIFEST_BASE_URL, type PdfManifest } from "./types";
import { errorMessage } from "./logger";

export async function fetchManifest(manifestUrl: string, timeoutMs = 8000): Promise<{ ok: true; manifest: PdfManifest } | { ok: false; error: string }> {
  try {
    if (!manifestUrl || !/^https?:\/\//.test(manifestUrl)) {
      return { ok: false, error: `Invalid manifest URL: ${manifestUrl || "(empty)"}` };
    }

    const response = await withTimeout(fetch(manifestUrl), timeoutMs);
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status} ${response.statusText}` };
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      return { ok: false, error: `Manifest JSON parse failed: ${errorMessage(error)}` };
    }

    if (!isPdfManifest(json)) {
      return { ok: false, error: "Manifest is missing a valid pages map." };
    }

    return { ok: true, manifest: json };
  } catch (error) {
    return { ok: false, error: `Manifest fetch failed: ${errorMessage(error)}` };
  }
}

export function buildManifestUrl(input: string, sourcePdfId: string): string {
  const trimmed = (input || DEFAULT_MANIFEST_BASE_URL).trim().replace(/\/+$/, "");
  if (trimmed.endsWith(".json")) {
    return trimmed;
  }
  return `${trimmed}/${encodeURIComponent(sourcePdfId)}/manifest.json`;
}

export function resolvePageImageUrl(manifest: PdfManifest, sourcePdfId: string, pageNumber: number): { ok: true; url: string } | { ok: false; error: string } {
  if (manifest.sourcePdfId && manifest.sourcePdfId !== sourcePdfId) {
    return { ok: false, error: `Manifest sourcePdfId "${manifest.sourcePdfId}" does not match mapping "${sourcePdfId}".` };
  }

  if (typeof manifest.pageCount === "number" && pageNumber > manifest.pageCount) {
    return { ok: false, error: `Page ${pageNumber} exceeds manifest pageCount ${manifest.pageCount}.` };
  }

  const value = manifest.pages[String(pageNumber)] || manifest.pages[String(pageNumber).padStart(4, "0")];
  const url = typeof value === "string" ? value : value?.url;
  if (!url) {
    return { ok: false, error: `No image URL found for page ${pageNumber}.` };
  }

  return { ok: true, url };
}

export function getMockManifest(): PdfManifest {
  return {
    schemaVersion: 1,
    sourcePdfId: "test-doc",
    version: "mock-v1",
    pageCount: 1,
    pages: {
      "1": "http://localhost:9910/sample-assets/test-doc/page-0001.png"
    }
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function isPdfManifest(value: unknown): value is PdfManifest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const manifest = value as Partial<PdfManifest>;
  return Boolean(manifest.pages && typeof manifest.pages === "object" && !Array.isArray(manifest.pages));
}
