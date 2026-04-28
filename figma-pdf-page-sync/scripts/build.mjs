import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const distDir = path.resolve("dist");
const uiBundlePath = path.join(distDir, "ui.js");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await build({
  entryPoints: ["src/code.ts"],
  outfile: "dist/code.js",
  bundle: true,
  format: "iife",
  target: "es2017",
  sourcemap: "inline",
  logLevel: "info"
});

await build({
  entryPoints: ["src/ui.ts"],
  outfile: uiBundlePath,
  bundle: true,
  format: "iife",
  target: "es2017",
  sourcemap: "inline",
  logLevel: "info"
});

const html = await readFile("src/ui.html", "utf8");
const uiJs = await readFile(uiBundlePath, "utf8");
await writeFile("dist/ui.html", html.replace("<!-- UI_SCRIPT -->", `<script>\n${uiJs}\n</script>`));
await rm(uiBundlePath, { force: true });

console.log("Built PDF Page Sync plugin into dist/.");
