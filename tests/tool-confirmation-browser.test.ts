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
    await page.setContent(`<section><p>Codex Native needs permission to continue</p>
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
