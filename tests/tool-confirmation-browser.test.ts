import { expect, test } from "bun:test";
import { chromium } from "playwright-core";
import { resolveChatGptToolConfirmation } from "../src/adapters/chatgpt-web/browser-worker";

const executablePath = process.env.CHATGPT_DOM_TEST_BROWSER;

test.skipIf(!executablePath)("tool approval survives delayed controls in a real browser DOM", async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<div role="alert"><div>Allow ChatGPT to use Codex Native</div><div id="actions"></div></div>
      <script>
        setTimeout(() => {
          document.querySelector("#actions").innerHTML = '<button>Deny</button><button>Allow once</button>';
        }, 50);
        document.addEventListener("click", event => {
          if (event.target instanceof HTMLButtonElement && event.target.textContent === "Allow once") {
            document.querySelector('[role="alert"]')?.remove();
          }
        });
      </script>`);

    expect(await resolveChatGptToolConfirmation(page, "Codex Native", true)).toBeTrue();
    expect(await page.getByRole("alert").count()).toBe(0);
  } finally {
    await browser.close();
  }
}, 30_000);

test.skipIf(!executablePath)("tool approval uses semantic controls when ChatGPT changes its wrapper and copy", async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<section><div><p>Codex Native needs permission to continue</p></div>
      <div><button>Deny</button><button>Allow</button></div></section>
      <script>
        document.addEventListener("click", event => {
          if (event.target instanceof HTMLButtonElement && event.target.textContent === "Allow") {
            document.querySelector("section")?.remove();
          }
        });
      </script>`);

    expect(await resolveChatGptToolConfirmation(page, "Codex Native", true)).toBeTrue();
    expect(await page.locator("section").count()).toBe(0);
  } finally {
    await browser.close();
  }
}, 30_000);

test.skipIf(!executablePath)("tool approval accepts nested labels without opening the persistent-permission menu", async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<div role="alert">
      <div>Allow ChatGPT to use Codex Native?</div>
      <div>
        <button id="deny"><span>Deny</span><kbd>Esc</kbd></button>
        <div>
          <button id="allow-once"><span>Allow once</span><kbd>Enter</kbd></button>
          <button id="approval-menu" aria-label="More approval options">⌄</button>
        </div>
      </div>
    </div>
    <script>
      globalThis.__approvalClicks = [];
      document.addEventListener("click", event => {
        const button = event.target instanceof Element ? event.target.closest("button") : null;
        if (!(button instanceof HTMLButtonElement)) return;
        globalThis.__approvalClicks.push(button.id);
        if (button.id === "allow-once") document.querySelector('[role="alert"]')?.remove();
      });
    </script>`);

    expect(await resolveChatGptToolConfirmation(page, "Codex Native", true)).toBeTrue();
    expect(await page.getByRole("alert").count()).toBe(0);
    expect(await page.evaluate(() => (globalThis as typeof globalThis & { __approvalClicks: string[] }).__approvalClicks))
      .toEqual(["allow-once"]);
  } finally {
    await browser.close();
  }
}, 30_000);
