const fs = require('node:fs');
const { defineConfig } = require('@playwright/test');

const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const launchOptions = fs.existsSync(localChrome) ? { executablePath: localChrome } : {};

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    browserName: 'chromium',
    launchOptions
  },
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true
  }
});
