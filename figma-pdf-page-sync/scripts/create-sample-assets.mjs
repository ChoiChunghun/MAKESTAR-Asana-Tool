import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("sample-assets");
const docDir = path.join(root, "test-doc");
await mkdir(docDir, { recursive: true });

const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAZ0lEQVR4nO3PAQ3AMAzAsH78OfckLi26VkQRMObaWw3w1wP4mmAAwwAGMAxgGMAwhmEAwwCGMQzDABowjGEYwDCAYQDDGIYBDAMYxjAMYBjAMIBhDMMwhmEAwxiGAQwDGAYwjGEYwDAG4A9SOQJ9SrBzRwAAAABJRU5ErkJggg==";
const png = Buffer.from(pngBase64, "base64");

await writeFile(path.join(root, "test-image.png"), png);
await writeFile(path.join(docDir, "page-0001.png"), png);

const manifest = {
  schemaVersion: 1,
  sourcePdfId: "test-doc",
  version: "sample-v1",
  pageCount: 1,
  pages: {
    "1": "http://localhost:9910/sample-assets/test-doc/page-0001.png"
  }
};

await writeFile(path.join(docDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Sample assets ready at ${root}`);
