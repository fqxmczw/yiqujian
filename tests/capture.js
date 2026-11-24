const fs = require('node:fs');
const { chromium } = require('@playwright/test');

const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const launchOptions = fs.existsSync(localChrome) ? { executablePath: localChrome } : {};

(async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4173');
  await page.screenshot({ path: 'test-results/exclusive-home.png', fullPage: true, animations: 'disabled' });
  await page.goto('http://127.0.0.1:4173/#pickup');
  await page.locator('#empty-add-code').click();
  await page.locator('#code-input').fill('8-2-3065');
  await page.locator('#label-input').fill('北门驿站');
  await page.locator('#code-form [type="submit"]').click();
  await page.screenshot({ path: 'test-results/pickup-saved.png', fullPage: true, animations: 'disabled' });
  await browser.close();
})();
