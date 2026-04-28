import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const CWD = process.cwd();
const DATA_DIR = path.join(CWD, "data");
const OUTPUT_DIR = path.join(CWD, "outputs");
const PAIRS_DIR = path.join(CWD, "pairs");

const DEFAULT_MANIFEST = path.join(PAIRS_DIR, "pairs.csv");
const STORAGE_STATE_PATH = path.join(DATA_DIR, "genspark-auth.json");
const GensparkUrl = "https://www.genspark.ai/ai_image";

const REQUEST_TEXT =
  "처음 올린 원본을 이후 올린 보정본 처럼 만들려면 어떤 프롬프트가 필요한가?";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parseArgs(argv) {
  const args = {
    setup: false,
    manifest: DEFAULT_MANIFEST,
    headed: true,
    slowMo: 80,
    timeoutMs: 120000
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--setup") args.setup = true;
    if (a === "--headed=false") args.headed = false;
    if (a.startsWith("--manifest=")) args.manifest = a.split("=")[1];
    if (a.startsWith("--slowmo=")) args.slowMo = Number(a.split("=")[1]);
    if (a.startsWith("--timeout-ms=")) args.timeoutMs = Number(a.split("=")[1]);
  }
  return args;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[,"\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      const next = line[i + 1];
      if (ch === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cols.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    cols.push(current);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });
    return row;
  });
}

function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest not found: ${manifestPath}`);
  }
  const content = fs.readFileSync(manifestPath, "utf8");
  const rows = parseCsv(content);
  if (!rows.length) throw new Error("manifest is empty");

  const required = ["id", "original_path", "edited_path"];
  const missing = required.filter((k) => !(k in rows[0]));
  if (missing.length) {
    throw new Error(`manifest missing columns: ${missing.join(", ")}`);
  }

  return rows.map((r) => ({
    id: r.id,
    category: r.category || "",
    originalPath: path.isAbsolute(r.original_path)
      ? r.original_path
      : path.join(CWD, r.original_path),
    editedPath: path.isAbsolute(r.edited_path)
      ? r.edited_path
      : path.join(CWD, r.edited_path)
  }));
}

async function waitForEnter(message) {
  process.stdout.write(`${message}\n`);
  process.stdout.write("엔터를 누르면 계속합니다: ");
  await new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => resolve());
  });
}

async function setupAuth(args) {
  ensureDir(DATA_DIR);
  const browser = await chromium.launch({
    headless: !args.headed,
    slowMo: args.slowMo
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(GensparkUrl, { waitUntil: "domcontentloaded" });

  await waitForEnter(
    [
      "[SETUP] 브라우저에서 Genspark 로그인 상태를 완료하세요.",
      "[SETUP] ai_image 페이지가 열린 상태에서 엔터를 누르면 세션을 저장합니다."
    ].join("\n")
  );

  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
  console.log(`[DONE] saved auth to ${STORAGE_STATE_PATH}`);
}

async function clickFirstVisible(page, selectors) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if (await loc.count()) {
      try {
        if (await loc.isVisible()) {
          await loc.click({ timeout: 3000 });
          return true;
        }
      } catch {
        // try next selector
      }
    }
  }
  return false;
}

async function ensureAutoPromptEnabled(page) {
  const toggleSelectors = [
    'button:has-text("Auto Prompt")',
    'button:has-text("Auto-Prompt")',
    'button:has-text("자동 프롬프트")',
    'label:has-text("Auto Prompt")',
    '[role="switch"][aria-label*="Auto"]',
    '[role="switch"][aria-label*="자동"]'
  ];

  for (const sel of toggleSelectors) {
    const loc = page.locator(sel).first();
    if (!(await loc.count())) continue;
    try {
      if (!(await loc.isVisible())) continue;
    } catch {
      continue;
    }

    let checked = null;
    try {
      const ariaChecked = await loc.getAttribute("aria-checked");
      if (ariaChecked === "true" || ariaChecked === "false") {
        checked = ariaChecked === "true";
      }
    } catch {
      checked = null;
    }

    if (checked === false) {
      await loc.click();
      await page.waitForTimeout(500);
    }
    if (checked === null) {
      // Unknown state. Click once to ensure the control is touched.
      await loc.click();
      await page.waitForTimeout(500);
    }
    return true;
  }
  return false;
}

async function uploadPair(page, originalPath, editedPath) {
  const existsOriginal = fs.existsSync(originalPath);
  const existsEdited = fs.existsSync(editedPath);
  if (!existsOriginal || !existsEdited) {
    throw new Error(
      `file missing original=${existsOriginal} edited=${existsEdited}`
    );
  }

  const fileInputs = page.locator('input[type="file"]');
  await page.waitForTimeout(1000);
  const count = await fileInputs.count();

  if (count >= 2) {
    await fileInputs.nth(0).setInputFiles(originalPath);
    await page.waitForTimeout(400);
    await fileInputs.nth(1).setInputFiles(editedPath);
    return;
  }

  if (count === 1) {
    const input = fileInputs.first();
    const isMultiple = (await input.getAttribute("multiple")) !== null;
    if (isMultiple) {
      await input.setInputFiles([originalPath, editedPath]);
      return;
    }
    await input.setInputFiles(originalPath);
    await page.waitForTimeout(800);

    const addSecondClicked = await clickFirstVisible(page, [
      'button:has-text("Add image")',
      'button:has-text("Upload")',
      'button:has-text("이미지")',
      '[aria-label*="upload"]',
      '[aria-label*="Upload"]'
    ]);
    if (!addSecondClicked) {
      throw new Error("single file input found but no button for second upload");
    }

    const latestInput = page.locator('input[type="file"]').last();
    await latestInput.setInputFiles(editedPath);
    return;
  }

  const tryUploadButton = await clickFirstVisible(page, [
    'button:has-text("Upload")',
    'button:has-text("이미지")',
    '[aria-label*="upload"]'
  ]);
  if (tryUploadButton) {
    await page.waitForTimeout(300);
    const retryInputs = page.locator('input[type="file"]');
    const retryCount = await retryInputs.count();
    if (retryCount) {
      const input = retryInputs.first();
      await input.setInputFiles([originalPath, editedPath]);
      return;
    }
  }

  throw new Error("could not locate file input on page");
}

async function setRequestPrompt(page, text) {
  const textarea = page.locator("textarea").first();
  if (await textarea.count()) {
    await textarea.fill(text);
    return true;
  }

  const editable = page.locator('[contenteditable="true"]').first();
  if (await editable.count()) {
    await editable.click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.type(text);
    return true;
  }
  return false;
}

async function submitRun(page) {
  const clicked = await clickFirstVisible(page, [
    'button:has-text("Generate")',
    'button:has-text("Run")',
    'button:has-text("Create")',
    'button:has-text("생성")',
    'button[type="submit"]'
  ]);
  if (!clicked) {
    await page.keyboard.press("Enter");
  }
}

async function waitForResult(page, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hasBusy = await page
      .locator(':text-matches("Generating|Processing|생성 중|처리 중", "i")')
      .count();
    if (!hasBusy) {
      const hasCandidateText = await page
        .locator(
          'textarea, [contenteditable="true"], [class*="prompt"], [data-testid*="prompt"]'
        )
        .count();
      if (hasCandidateText) return;
    }
    await page.waitForTimeout(1500);
  }
}

async function extractPrompt(page) {
  const text = await page.evaluate(() => {
    const candidates = [];
    const push = (el, value) => {
      const txt = (value || "").trim();
      if (!txt) return;
      if (txt.length < 20 || txt.length > 2000) return;
      const meta = [
        el.tagName || "",
        el.id || "",
        el.className || "",
        el.getAttribute?.("data-testid") || "",
        el.getAttribute?.("aria-label") || "",
        el.getAttribute?.("name") || ""
      ]
        .join(" ")
        .toLowerCase();
      let score = 0;
      if (meta.includes("prompt")) score += 40;
      if (meta.includes("auto")) score += 10;
      if (txt.includes(", ")) score += 5;
      if (/high quality|masterpiece|photoreal|cinematic|dslr|8k/i.test(txt)) {
        score += 5;
      }
      if (/upload|login|sign in|이미지 업로드/i.test(txt)) score -= 20;
      candidates.push({ txt, score });
    };

    document.querySelectorAll("textarea").forEach((el) => push(el, el.value || ""));
    document
      .querySelectorAll('input[type="text"], input:not([type])')
      .forEach((el) => push(el, el.value || ""));
    document
      .querySelectorAll('[contenteditable="true"]')
      .forEach((el) => push(el, el.innerText || ""));
    document.querySelectorAll("pre, p, div, span").forEach((el) => {
      const idOrClass = `${el.id || ""} ${el.className || ""}`.toLowerCase();
      if (!idOrClass.includes("prompt")) return;
      push(el, el.innerText || "");
    });

    candidates.sort((a, b) => b.score - a.score || b.txt.length - a.txt.length);
    return candidates[0]?.txt || "";
  });

  return text.trim();
}

function appendResults(result) {
  ensureDir(OUTPUT_DIR);
  const csvPath = path.join(OUTPUT_DIR, "prompts.csv");
  const txtPath = path.join(OUTPUT_DIR, "prompts.txt");
  const errPath = path.join(OUTPUT_DIR, "errors.log");

  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(
      csvPath,
      "id,category,original_path,edited_path,success,prompt,error,created_at\n",
      "utf8"
    );
  }

  const row = [
    result.id,
    result.category,
    result.originalPath,
    result.editedPath,
    result.success ? "Y" : "N",
    result.prompt,
    result.error,
    new Date().toISOString()
  ]
    .map(csvEscape)
    .join(",");

  fs.appendFileSync(csvPath, `${row}\n`, "utf8");
  if (result.success) {
    fs.appendFileSync(
      txtPath,
      [
        `## ${result.id}`,
        `category: ${result.category || "-"}`,
        `original: ${result.originalPath}`,
        `edited: ${result.editedPath}`,
        result.prompt,
        ""
      ].join("\n"),
      "utf8"
    );
  } else {
    fs.appendFileSync(
      errPath,
      `[${new Date().toISOString()}] ${result.id}: ${result.error}\n`,
      "utf8"
    );
  }
}

async function runOne(page, row, timeoutMs) {
  await page.goto(GensparkUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  await ensureAutoPromptEnabled(page);
  await uploadPair(page, row.originalPath, row.editedPath);
  await page.waitForTimeout(1200);

  const promptSet = await setRequestPrompt(page, REQUEST_TEXT);
  if (!promptSet) throw new Error("prompt input field not found");

  await submitRun(page);
  await waitForResult(page, timeoutMs);

  const prompt = await extractPrompt(page);
  if (!prompt) throw new Error("prompt extraction failed");
  return prompt;
}

async function runBatch(args) {
  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    throw new Error(
      `auth file missing: ${STORAGE_STATE_PATH}\n먼저: npm run setup`
    );
  }

  const rows = readManifest(args.manifest);
  ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({
    headless: !args.headed,
    slowMo: args.slowMo
  });
  const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
  const page = await context.newPage();

  for (const row of rows) {
    const result = {
      ...row,
      success: false,
      prompt: "",
      error: ""
    };
    try {
      console.log(`[RUN] ${row.id}`);
      result.prompt = await runOne(page, row, args.timeoutMs);
      result.success = true;
      console.log(`[OK] ${row.id}`);
    } catch (error) {
      result.error = error?.message || String(error);
      console.error(`[FAIL] ${row.id}: ${result.error}`);
      const safeName = row.id.replace(/[^a-zA-Z0-9_-]/g, "_");
      const shot = path.join(OUTPUT_DIR, `${safeName}_error.png`);
      try {
        await page.screenshot({ path: shot, fullPage: true });
      } catch {
        // ignore screenshot failure
      }
    }
    appendResults(result);
    await page.waitForTimeout(1200);
  }

  await browser.close();
  console.log(`[DONE] results: ${OUTPUT_DIR}`);
}

async function main() {
  const args = parseArgs(process.argv);
  ensureDir(DATA_DIR);
  ensureDir(PAIRS_DIR);
  ensureDir(OUTPUT_DIR);

  if (args.setup) {
    await setupAuth(args);
    return;
  }

  await runBatch(args);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
