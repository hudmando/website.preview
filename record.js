const { chromium } = require('playwright');

// ---- Tunable timing (ms) ----
const HOLD_HERO_MS = 600;
const SCROLL_HOME_MS = 3400;
const WAIT_AFTER_CLICK_MS = 900;
const SCROLL_GATHER_MS = 4200;
const HOLD_END_MS = 700;

const VIEWPORT = { width: 1080, height: 1920 }; // vertical/social; swap to {1920,1080} for landscape

async function smoothScrollToBottom(page, durationMs) {
  await page.evaluate((duration) => {
    return new Promise((resolve) => {
      const startY = window.scrollY;
      const endY = document.body.scrollHeight - window.innerHeight;
      const startTime = performance.now();
      function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      }
      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        window.scrollTo(0, startY + (endY - startY) * easeInOutQuad(progress));
        if (progress < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }, durationMs);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: 'videos/', size: VIEWPORT },
  });
  const page = await context.newPage();

  await page.goto('https://kairosministries.net/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(HOLD_HERO_MS);

  await smoothScrollToBottom(page, SCROLL_HOME_MS);

  const gatherLink = page.locator('a[href="https://kairosministries.net/gather"]').last();
  await gatherLink.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(WAIT_AFTER_CLICK_MS);

  await smoothScrollToBottom(page, SCROLL_GATHER_MS);
  await page.waitForTimeout(HOLD_END_MS);

  await context.close();
  await browser.close();
})();
