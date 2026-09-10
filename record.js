const { chromium } = require('playwright');
const fs = require('fs');

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
  fs.mkdirSync('videos', { recursive: true });
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: { dir: 'videos/', size: VIEWPORT },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.setDefaultNavigationTimeout(45000);

    // 'networkidle' hangs on pages with persistent background activity
    // (embeds, analytics, CDNs). 'load' is enough since we control our own
    // scroll/click timing after this.
    await page.goto('https://kairosministries.net/', { waitUntil: 'load' });
    await page.waitForTimeout(HOLD_HERO_MS);

    await smoothScrollToBottom(page, SCROLL_HOME_MS);

    // Prefer the footer's exact Gather link; fall back to the last matching
    // link anywhere on the page if the footer selector doesn't match.
    let gatherLink = page.locator('footer a[href="https://kairosministries.net/gather"]');
    if ((await gatherLink.count()) === 0) {
      gatherLink = page.locator('a[href="https://kairosministries.net/gather"]').last();
    }
    await gatherLink.first().click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(WAIT_AFTER_CLICK_MS);

    await smoothScrollToBottom(page, SCROLL_GATHER_MS);
    await page.waitForTimeout(HOLD_END_MS);

    await context.close();
    await browser.close();

    fs.writeFileSync('run-status.txt', 'SUCCESS\n' + new Date().toISOString() + '\n');
  } catch (err) {
    const detail = 'FAILURE\n' + new Date().toISOString() + '\n\n' +
      (err && err.stack ? err.stack : String(err)) + '\n';
    fs.writeFileSync('run-status.txt', detail);
    if (browser) await browser.close().catch(() => {});
    process.exitCode = 1;
  }
})();
